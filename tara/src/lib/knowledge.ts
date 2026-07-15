// Knowledge Centre articles — ported from the design reference's `articles`.

export interface Article {
  tag: string;
  tagColor: string;
  title: string;
  excerpt: string;
  author: string;
  date: string;
}

export const articles: Article[] = [
  {
    tag: "ANALYTICAL METHODS",
    tagColor: "#1565C0",
    title: "How to read a Certificate of Analysis",
    excerpt:
      "Identity, assay, purity, and the methods behind each line — and what a COA can and cannot tell you.",
    author: "Dr. M. Kettering",
    date: "2026-04-30",
  },
  {
    tag: "QUALITY",
    tagColor: "#1B5E20",
    title: "HPLC purity, and what the percentage means",
    excerpt:
      "A 99% purity figure is meaningful only alongside its method and column. Here is how to interpret it.",
    author: "Dr. A. Lindqvist",
    date: "2026-04-12",
  },
  {
    tag: "HANDLING",
    tagColor: "#B87333",
    title: "Reconstitution and storage of lyophilised peptides",
    excerpt:
      "Diluent choice, concentration, and cold-chain — the handling decisions that preserve a compound's integrity.",
    author: "S. Wehner, MSc",
    date: "2026-03-27",
  },
  {
    tag: "TRACEABILITY",
    tagColor: "#6A1B9A",
    title: "What a batch record actually contains",
    excerpt:
      "From supplier lot to released vial: the fields on a batch record and why each one is retained.",
    author: "Dr. M. Kettering",
    date: "2026-03-08",
  },
  {
    tag: "PROVENANCE",
    tagColor: "#1B5E20",
    title: "Why German sourcing, specifically",
    excerpt:
      "Regulatory environment, manufacturing standards, and documentation culture — the case for a single origin.",
    author: "Editorial",
    date: "2026-02-20",
  },
  {
    tag: "COMPLIANCE",
    tagColor: "#1565C0",
    title: "“Research use only” is not a formality",
    excerpt:
      "What the classification means for how materials are described, sold, and handled — with no exceptions.",
    author: "Compliance",
    date: "2026-02-02",
  },
];
