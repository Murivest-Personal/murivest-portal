import type { Metadata } from "next";
export const metadata: Metadata = { title: "About Murivest" };
export default function Page() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="font-serif text-4xl font-semibold">About Murivest Group</h1>
      <p className="mt-6 text-lg leading-relaxed">
        Murivest Group Ltd advises institutional investors on the acquisition of income-producing commercial property.
        Our identity is the Differential: we diagnose commercial real estate deals by ranking competing explanations of
        value, testing the assumptions that move the answer, ruling out the stories that fail, and pricing the gap
        between consensus and reality.
      </p>
      <h2 className="mt-10 text-2xl font-semibold">Managing Director</h2>
      <p className="mt-3">Mark Muriithi — Principal, Differential Underwriting, Murivest Group Ltd. Institutional Real Estate Advisory.</p>
      <h2 className="mt-10 text-2xl font-semibold">What we do</h2>
      <ul className="mt-3 list-disc pl-6 space-y-2">
        <li>Differential Underwriting of income-producing CRE assets.</li>
        <li>Market mastery: tenure, zoning, tax across every market we operate in.</li>
        <li>KYC/AML and transaction integrity as a stage gate, not an afterthought.</li>
        <li>Mandate-only execution for UHNWIs, family offices and institutions.</li>
      </ul>
    </main>
  );
}
