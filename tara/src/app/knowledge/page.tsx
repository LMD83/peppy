import { articles } from "@/lib/knowledge";

export default function KnowledgePage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-14">
      <p
        className="mb-2 text-xs font-semibold tracking-[0.18em]"
        style={{ color: "#1565C0" }}
      >
        KNOWLEDGE CENTRE
      </p>
      <h1 className="mb-3 max-w-2xl font-serif text-4xl font-semibold text-foreground">
        Technical education, written to be cited.
      </h1>
      <p className="mb-10 max-w-2xl text-[15.5px] leading-relaxed text-muted-foreground">
        Author attribution, references, and revision dates — and zero product promotion inside
        educational content. The article that never mentions a product builds the most trust in all
        of them.
      </p>

      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
        {articles.map((a) => (
          <article
            key={a.title}
            className="flex h-full flex-col rounded-md border border-border bg-card p-6"
          >
            <p
              className="mb-3 text-[11px] font-bold tracking-[0.14em]"
              style={{ color: a.tagColor }}
            >
              {a.tag}
            </p>
            <h2 className="mb-3 font-serif text-lg font-semibold leading-tight text-foreground">
              {a.title}
            </h2>
            <p className="text-sm leading-relaxed text-muted-foreground">{a.excerpt}</p>

            <div className="mt-auto flex items-center justify-between gap-3 border-t border-border pt-4">
              <span className="text-xs text-muted-foreground">{a.author}</span>
              <span className="font-mono text-xs text-muted-foreground">{a.date}</span>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
