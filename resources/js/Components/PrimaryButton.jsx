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
                `inline-flex items-center justify-center rounded-lg bg-[#FFB800] px-4 py-2 text-sm font-semibold text-white transition-all duration-200 hover:bg-[#FFC933] focus:outline-none focus:ring-2 focus:ring-[#FFB800] focus:ring-offset-2 active:bg-[#E6A600] disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg ` +
                className
            }
            disabled={disabled}
        >
            {children}
        </button>
    );
}
