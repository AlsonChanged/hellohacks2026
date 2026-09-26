export function CategoryTag({ name }: { name: string }) {
	return <span className={`category-tag category-${name.toLowerCase()}`}>{name}</span>;
}
