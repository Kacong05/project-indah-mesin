import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';

export default forwardRef(function TextInput(
    { type = 'text', className = '', isFocused = false, ...props },
    ref,
) {
    const localRef = useRef(null);

    useImperativeHandle(ref, () => ({
        focus: () => localRef.current?.focus(),
    }));

    useEffect(() => {
        if (isFocused) {
            localRef.current?.focus();
        }
    }, [isFocused]);

    return (
        <input
            {...props}
            type={type}
            className={
                'border-white/10 bg-white/5 text-white placeholder-slate-400 focus:border-indigo-500 focus:ring-indigo-500 rounded-lg shadow-sm transition duration-150 ease-in-out ' +
                className
            }
            ref={localRef}
        />
    );
});
