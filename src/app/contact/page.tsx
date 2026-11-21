import type { Metadata } from "next";
export const metadata: Metadata = { title: "Contact" };
export default function Page() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="font-serif text-4xl font-semibold">Contact Murivest</h1>
      <p className="mt-6">Mark Muriithi — Principal, Differential Underwriting</p>
      <p className="mt-2">Murivest Group Ltd — Institutional Real Estate Advisory</p>
      <p className="mt-6">Email: info@murivest.com · Mandate enquiries by appointment.</p>
    </main>
  );
}
