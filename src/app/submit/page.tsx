import { SubmitForm } from "@/components/SubmitForm";

export const metadata = { title: "Submit an opportunity — RTP Pathway" };

export default function SubmitPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-bold text-stone-900">Submit an opportunity</h1>
      <p className="mt-1 mb-6 text-sm text-stone-600">
        Nonprofits, schools, libraries, and local businesses: share your internship, volunteer role,
        scholarship, or program with Triangle students. Paste your existing description and let AI
        structure it — you stay in control of every field.
      </p>
      <SubmitForm />
    </div>
  );
}
