export default function PrimaryButton({
    className = '',
    disabled,
    children,
    ...props
}) {
    return (
        <button
            {...props}
            className={
                `inline-flex items-center justify-center rounded-lg bg-[#FF7A00] px-4 py-2 text-sm font-semibold text-white transition-all duration-200 hover:bg-[#FF8C1A] focus:outline-none focus:ring-2 focus:ring-[#FF7A00] focus:ring-offset-2 active:bg-[#E66A00] disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg ` +
                className
            }
            disabled={disabled}
        >
            {children}
        </button>
    );
}
