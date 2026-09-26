type SearchBoxProps = {
	value: string;
	onChange: (value: string) => void;
	placeholder?: string;
	label?: string;
};

export function SearchBox({
	value,
	onChange,
	placeholder = "Search events, clubs, or places",
	label = "Search events, clubs, or places",
}: SearchBoxProps) {
	return (
		<div className="search-box">
			<span className="search-icon" aria-hidden="true" />
			<input
				aria-label={label}
				placeholder={placeholder}
				value={value}
				onChange={(event) => onChange(event.target.value)}
			/>
		</div>
	);
}
