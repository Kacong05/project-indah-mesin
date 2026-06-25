export default function ApplicationLogo({ className = '', alt = 'Logo' }) {
    return (
        <img
            src="/logo.png"
            alt={alt}
            className={className}
            onError={(e) => {
                // Fallback: hide broken image and show text
                e.target.style.display = 'none';
                e.target.nextSibling && (e.target.nextSibling.style.display = 'flex');
            }}
        />
    );
}
