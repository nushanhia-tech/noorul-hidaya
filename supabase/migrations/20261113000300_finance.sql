-- =====================================================================
-- 0003 FEES & ACCOUNTS
-- Money is numeric(12,2). Online payments are only "verified" after a
-- server-side signature check. Sandbox payments are stored with
-- mode = 'sandbox' and are excluded from every financial total.
-- =====================================================================

create table public.fee_heads (
  id         uuid primary key default gen_random_uuid(),
  code       text not null unique check (code ~ '^[A-Z0-9_]{2,16}$'),
  name       text not null unique,
  created_at timestamptz not null default now()
);

create table public.fee_structures (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  programme_id     uuid not null references public.programmes (id) on delete restrict,
  academic_year_id uuid not null references public.academic_years (id) on delete restrict,
  semester_number  int not null check (semester_number between 1 and 12),
  due_date         date not null,
  is_active        boolean not null default true,
  created_by       uuid references public.profiles (id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (programme_id, academic_year_id, semester_number, name)
);
create trigger fee_structures_updated before update on public.fee_structures for each row execute function public.set_updated_at();

create table public.fee_structure_items (
  id           uuid primary key default gen_random_uuid(),
  structure_id uuid not null references public.fee_structures (id) on delete cascade,
  fee_head_id  uuid not null references public.fee_heads (id) on delete restrict,
  amount       numeric(12,2) not null check (amount > 0),
  unique (structure_id, fee_head_id)
);

-- Fee assignment to a student
create table public.invoices (
  id           uuid primary key default gen_random_uuid(),
  invoice_no   text not null unique,
  student_id   uuid not null references public.students (id) on delete restrict,
  structure_id uuid references public.fee_structures (id) on delete set null,
  title        text not null,
  amount       numeric(12,2) not null check (amount > 0),
  due_date     date not null,
  issued_by    uuid references public.profiles (id) on delete set null,
  issued_at    timestamptz not null default now(),
  cancelled_at timestamptz,
  cancel_reason text,
  last_reminded_at timestamptz,
  created_at   timestamptz not null default now(),
  unique (student_id, structure_id)
);
create index invoices_student_idx on public.invoices (student_id);
create index invoices_due_idx on public.invoices (due_date) where cancelled_at is null;

create table public.concessions (
  id          uuid primary key default gen_random_uuid(),
  invoice_id  uuid not null references public.invoices (id) on delete restrict,
  student_id  uuid not null references public.students (id) on delete restrict,
  amount      numeric(12,2) not null check (amount > 0),
  category    text not null check (category in ('merit','need_based','staff_ward','sibling','sports','other')),
  reason      text not null check (char_length(reason) >= 5),
  status      text not null default 'approved' check (status in ('approved','revoked')),
  approved_by uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now()
);
create index concessions_invoice_idx on public.concessions (invoice_id);

create table public.payments (
  id                  uuid primary key default gen_random_uuid(),
  student_id          uuid not null references public.students (id) on delete restrict,
  invoice_id          uuid not null references public.invoices (id) on delete restrict,
  amount              numeric(12,2) not null check (amount > 0),
  method              text not null check (method in ('cash','bank_transfer','upi','cheque','demand_draft','online')),
  mode                text not null default 'live' check (mode in ('live','sandbox')),
  status              text not null default 'pending' check (status in ('pending','verified','failed','reversed')),
  provider            text,                 -- e.g. 'razorpay', 'sandbox', null for counter collection
  provider_order_id   text,
  provider_payment_id text,
  reference_no        text,                 -- cheque / UTR / DD number
  idempotency_key     text unique,
  collected_by        uuid references public.profiles (id) on delete set null,
  paid_at             timestamptz,
  notes               text,
  reconciled_at       timestamptz,
  reconciled_by       uuid references public.profiles (id) on delete set null,
  bank_reference      text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (provider, provider_payment_id),
  check (status <> 'verified' or paid_at is not null)
);
create unique index payments_provider_order_uniq on public.payments (provider, provider_order_id) where provider_order_id is not null;
create index payments_student_idx on public.payments (student_id);
create index payments_invoice_idx on public.payments (invoice_id);
create index payments_paid_idx on public.payments (paid_at) where status = 'verified';
create trigger payments_updated before update on public.payments for each row execute function public.set_updated_at();

create table public.receipts (
  id         uuid primary key default gen_random_uuid(),
  receipt_no text not null unique,
  payment_id uuid not null unique references public.payments (id) on delete restrict,
  issued_by  uuid references public.profiles (id) on delete set null,
  issued_at  timestamptz not null default now()
);

create table public.refunds (
  id           uuid primary key default gen_random_uuid(),
  payment_id   uuid not null references public.payments (id) on delete restrict,
  student_id   uuid not null references public.students (id) on delete restrict,
  amount       numeric(12,2) not null check (amount > 0),
  reason       text not null check (char_length(reason) >= 5),
  status       text not null default 'requested' check (status in ('requested','approved','rejected','processed')),
  requested_by uuid references public.profiles (id) on delete set null,
  decided_by   uuid references public.profiles (id) on delete set null,
  decided_at   timestamptz,
  decision_note text,
  processed_at timestamptz,
  processed_reference text,
  created_at   timestamptz not null default now()
);
create index refunds_payment_idx on public.refunds (payment_id);

create table public.payment_corrections (
  id           uuid primary key default gen_random_uuid(),
  payment_id   uuid not null references public.payments (id) on delete restrict,
  field        text not null check (field in ('reference_no','method','paid_at','notes','status')),
  old_value    text,
  new_value    text,
  reason       text not null check (char_length(reason) >= 5),
  corrected_by uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now()
);

-- Reference numbers
create or replace function public.set_invoice_no() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.invoice_no is null or new.invoice_no = '' then new.invoice_no := public.next_reference('INV', 6); end if;
  return new;
end $$;
create trigger invoices_no before insert on public.invoices for each row execute function public.set_invoice_no();

create or replace function public.set_receipt_no() returns trigger language plpgsql security definer set search_path = public as $$
declare v_status text; v_mode text;
begin
  select status, mode into v_status, v_mode from public.payments where id = new.payment_id;
  if v_status is distinct from 'verified' then
    raise exception 'Receipts can only be issued for verified payments';
  end if;
  new.receipt_no := case when v_mode = 'sandbox' then public.next_reference('SANDBOX-RCPT', 6) else public.next_reference('RCPT', 6) end;
  return new;
end $$;
create trigger receipts_no before insert on public.receipts for each row execute function public.set_receipt_no();

-- Payment amount cannot exceed the invoice's outstanding balance.
create or replace function public.invoice_outstanding(p_invoice uuid, p_exclude_payment uuid default null)
returns numeric language sql stable security definer set search_path = public as $$
  select i.amount
    - coalesce((select sum(c.amount) from public.concessions c where c.invoice_id = i.id and c.status = 'approved'), 0)
    - coalesce((select sum(p.amount) from public.payments p where p.invoice_id = i.id and p.status = 'verified' and p.mode = 'live'
                and (p_exclude_payment is null or p.id <> p_exclude_payment)), 0)
    + coalesce((select sum(r.amount) from public.refunds r join public.payments p on p.id = r.payment_id
                where p.invoice_id = i.id and r.status = 'processed' and p.mode = 'live'), 0)
  from public.invoices i where i.id = p_invoice;
$$;

create or replace function public.guard_payment()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_student uuid; v_cancelled timestamptz;
begin
  select student_id, cancelled_at into v_student, v_cancelled from public.invoices where id = new.invoice_id;
  if v_student is distinct from new.student_id then
    raise exception 'Payment student does not match invoice';
  end if;
  if tg_op = 'INSERT' and v_cancelled is not null then
    raise exception 'Invoice is cancelled';
  end if;
  if new.status = 'verified' and new.mode = 'live'
     and (tg_op = 'INSERT' or old.status is distinct from 'verified')
     and new.amount > public.invoice_outstanding(new.invoice_id, new.id) then
    raise exception 'Payment of % exceeds outstanding balance of %', new.amount, public.invoice_outstanding(new.invoice_id, new.id)
      using errcode = '23514';
  end if;
  return new;
end $$;
create trigger payments_guard before insert or update on public.payments for each row execute function public.guard_payment();

create or replace function public.guard_concession()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_prior numeric := 0;
begin
  if tg_op = 'UPDATE' and old.status = 'approved' then v_prior := old.amount; end if;
  if new.status = 'approved' and new.amount > public.invoice_outstanding(new.invoice_id) + v_prior then
    raise exception 'Concession exceeds outstanding balance' using errcode = '23514';
  end if;
  if (select student_id from public.invoices where id = new.invoice_id) is distinct from new.student_id then
    raise exception 'Concession student does not match invoice';
  end if;
  return new;
end $$;
create trigger concessions_guard before insert or update on public.concessions for each row execute function public.guard_concession();

create or replace function public.guard_refund()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_paid numeric; v_refunded numeric; v_status text; v_mode text;
begin
  select amount, status, mode into v_paid, v_status, v_mode from public.payments where id = new.payment_id;
  if v_status <> 'verified' or v_mode <> 'live' then raise exception 'Only verified live payments can be refunded'; end if;
  select coalesce(sum(amount), 0) into v_refunded from public.refunds
    where payment_id = new.payment_id and status in ('requested','approved','processed') and id <> new.id;
  if new.status in ('requested','approved','processed') and v_refunded + new.amount > v_paid then
    raise exception 'Refund exceeds the refundable amount' using errcode = '23514';
  end if;
  return new;
end $$;
create trigger refunds_guard before insert or update on public.refunds for each row execute function public.guard_refund();

-- ---------------------------------------------------------------------
-- Balances (security_invoker: RLS of the caller applies)
-- ---------------------------------------------------------------------
create view public.invoice_balances with (security_invoker = true) as
select
  i.id as invoice_id, i.invoice_no, i.student_id, i.title, i.amount, i.due_date, i.issued_at, i.cancelled_at,
  coalesce(c.total, 0) as concession_total,
  coalesce(p.total, 0) as paid_total,
  coalesce(r.total, 0) as refunded_total,
  case when i.cancelled_at is not null then 0
       else i.amount - coalesce(c.total, 0) - coalesce(p.total, 0) + coalesce(r.total, 0) end as outstanding,
  case
    when i.cancelled_at is not null then 'cancelled'
    when i.amount - coalesce(c.total, 0) - coalesce(p.total, 0) + coalesce(r.total, 0) <= 0 then 'paid'
    when coalesce(p.total, 0) > 0 then 'partially_paid'
    when i.due_date < current_date then 'overdue'
    else 'open'
  end as status
from public.invoices i
left join lateral (select sum(amount) total from public.concessions where invoice_id = i.id and status = 'approved') c on true
left join lateral (select sum(amount) total from public.payments where invoice_id = i.id and status = 'verified' and mode = 'live') p on true
left join lateral (select sum(r.amount) total from public.refunds r join public.payments pp on pp.id = r.payment_id
                   where pp.invoice_id = i.id and r.status = 'processed' and pp.mode = 'live') r on true;

create view public.student_fee_balances with (security_invoker = true) as
select
  s.id as student_id,
  coalesce(sum(b.amount) filter (where b.cancelled_at is null), 0) as total_assigned,
  coalesce(sum(b.concession_total) filter (where b.cancelled_at is null), 0) as total_concession,
  coalesce(sum(b.paid_total), 0) as total_paid,
  coalesce(sum(b.refunded_total), 0) as total_refunded,
  coalesce(sum(b.outstanding), 0) as outstanding,
  min(b.due_date) filter (where b.outstanding > 0) as next_due
from public.students s
left join public.invoice_balances b on b.student_id = s.id
group by s.id;

-- ---------------------------------------------------------------------
-- Counter collection: atomic payment + receipt, idempotent.
-- ---------------------------------------------------------------------
create or replace function public.record_counter_payment(
  p_invoice uuid, p_amount numeric, p_method text, p_reference text,
  p_paid_at timestamptz, p_notes text, p_idempotency_key text
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_payment uuid; v_student uuid; v_existing uuid;
begin
  if not public.has_permission('finance.collect') then
    raise exception 'Not authorised to collect fees' using errcode = '42501';
  end if;
  if p_method not in ('cash','bank_transfer','upi','cheque','demand_draft') then
    raise exception 'Invalid payment method';
  end if;
  if p_method <> 'cash' and coalesce(trim(p_reference), '') = '' then
    raise exception 'A transaction reference is required for non-cash payments';
  end if;
  select id into v_existing from public.payments where idempotency_key = p_idempotency_key;
  if v_existing is not null then
    return v_existing;  -- duplicate submission: return the original payment
  end if;
  select student_id into v_student from public.invoices where id = p_invoice;
  if v_student is null then raise exception 'Invoice not found'; end if;

  insert into public.payments (student_id, invoice_id, amount, method, mode, status, reference_no,
                               idempotency_key, collected_by, paid_at, notes)
  values (v_student, p_invoice, round(p_amount, 2), p_method, 'live', 'verified', nullif(trim(p_reference), ''),
          p_idempotency_key, auth.uid(), coalesce(p_paid_at, now()), nullif(trim(p_notes), ''))
  returning id into v_payment;

  insert into public.receipts (payment_id, issued_by) values (v_payment, auth.uid());
  return v_payment;
end $$;

-- Online payment confirmation; called only by the server (service role)
-- after the provider signature has been verified. Idempotent.
create or replace function public.confirm_online_payment(
  p_provider text, p_order_id text, p_payment_id text, p_amount numeric
) returns uuid language plpgsql security definer set search_path = public as $$
declare v public.payments;
begin
  select * into v from public.payments where provider = p_provider and provider_order_id = p_order_id for update;
  if v.id is null then raise exception 'Unknown order'; end if;
  if v.status = 'verified' then return v.id; end if;       -- already confirmed (duplicate callback)
  if round(p_amount, 2) <> v.amount then
    update public.payments set status = 'failed', notes = coalesce(notes || E'\n', '') || 'Amount mismatch on callback' where id = v.id;
    raise exception 'Amount mismatch';
  end if;
  update public.payments set status = 'verified', provider_payment_id = p_payment_id, paid_at = now() where id = v.id;
  insert into public.receipts (payment_id) values (v.id);
  return v.id;
end $$;
revoke all on function public.confirm_online_payment(text, text, text, numeric) from public;
