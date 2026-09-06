import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Payment, FeeInvoice } from "@/lib/types";

/**
 * POST /api/payments
 *
 * Body: { invoiceId, amountPaid?, paymentMethod? }
 *
 * Mock payment flow:
 *   1. Fetch the invoice (verify it exists + caller is authorized).
 *   2. Insert a payment row.
 *   3. Update the invoice's status to 'paid'.
 *
 * Auth: the student themselves, a linked parent, or a principal/staff
 * of the school.
 */
export async function POST(request: Request) {
  let body: {
    invoiceId?: string;
    amountPaid?: number | string;
    paymentMethod?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const invoiceId = body.invoiceId?.trim();
  const paymentMethod = body.paymentMethod?.trim() || "mock_card";
  if (!invoiceId) {
    return NextResponse.json(
      { error: "invoiceId is required." },
      { status: 400 }
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  }

  const admin = createAdminClient();

  // Fetch the invoice + verify authorization.
  const { data: invoiceRow, error: invErr } = await admin
    .from("fee_invoices")
    .select("*")
    .eq("id", invoiceId)
    .single();
  if (invErr || !invoiceRow) {
    return NextResponse.json({ error: "Invoice not found." }, { status: 404 });
  }
  const invoice = invoiceRow as FeeInvoice;

  // Authorization: student, parent, or admin.
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, school_id")
    .eq("id", user.id)
    .single();
  if (!profile) {
    return NextResponse.json({ error: "Profile not found." }, { status: 403 });
  }

  const isStudent = invoice.student_id === user.id;
  let isParent = false;
  if (!isStudent) {
    const { data: link } = await admin
      .from("parent_student_links")
      .select("id")
      .eq("parent_id", user.id)
      .eq("student_id", invoice.student_id)
      .maybeSingle();
    isParent = !!link;
  }
  const isAdmin =
    (profile.role === "principal" || profile.role === "staff") &&
    profile.school_id === invoice.school_id;
  if (!isStudent && !isParent && !isAdmin) {
    return NextResponse.json(
      { error: "Not authorized to pay this invoice." },
      { status: 403 }
    );
  }

  // Already paid? Don't double-charge.
  if (invoice.status === "paid") {
    return NextResponse.json(
      { error: "This invoice has already been paid." },
      { status: 400 }
    );
  }

  const amountPaid =
    body.amountPaid != null
      ? typeof body.amountPaid === "string"
        ? parseFloat(body.amountPaid)
        : body.amountPaid
      : parseFloat(String(invoice.total_amount));

  if (Number.isNaN(amountPaid) || amountPaid < 0) {
    return NextResponse.json(
      { error: "amountPaid must be a non-negative number." },
      { status: 400 }
    );
  }

  // Insert the payment row.
  const { data: paymentRow, error: payErr } = await admin
    .from("payments")
    .insert({
      invoice_id: invoiceId,
      amount_paid: amountPaid,
      payment_method: paymentMethod,
    })
    .select("*")
    .single();

  if (payErr || !paymentRow) {
    return NextResponse.json(
      {
        error:
          "Could not record payment. Make sure the Phase 6 migration has been applied. " +
          (payErr?.message ?? "unknown error"),
      },
      { status: 500 }
    );
  }

  // Mark the invoice as paid.
  const { error: updateErr } = await admin
    .from("fee_invoices")
    .update({ status: "paid" })
    .eq("id", invoiceId);

  if (updateErr) {
    // The payment went through but the invoice update failed — log it.
    console.warn("Payment recorded but invoice status not updated:", updateErr.message);
  }

  return NextResponse.json({
    payment: paymentRow as Payment,
    invoiceId,
    status: "paid",
  });
}
