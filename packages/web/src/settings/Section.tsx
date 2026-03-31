export function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div>
        <h3 className="text-base font-semibold">{title}</h3>
        <hr className="mt-1 mb-4" />
        {description && (
          <p className="mb-2 text-sm text-gray-500">{description}</p>
        )}
      </div>
      {children}
    </section>
  );
}
