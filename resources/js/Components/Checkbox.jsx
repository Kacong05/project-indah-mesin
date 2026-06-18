export default function Checkbox({ className = '', ...props }) {
    return (
        <input
            {...props}
            type="checkbox"
            className={
                'rounded border-white/20 bg-white/5 text-indigo-500 shadow-sm focus:ring-indigo-500 focus:ring-offset-slate-900 ' +
                className
            }
        />
    );
}
