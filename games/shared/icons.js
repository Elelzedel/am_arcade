import faviconIco from '../../assets/icons/favicon.ico';
import faviconSvg from '../../assets/icons/favicon.svg';
import favicon32 from '../../assets/icons/favicon-32.png';
import favicon16 from '../../assets/icons/favicon-16.png';
import appleTouch from '../../assets/icons/apple-touch-icon.png';
import pinnedTab from '../../assets/icons/safari-pinned-tab.svg';
import icon192 from '../../assets/icons/icon-192.png';
import icon512 from '../../assets/icons/icon-512.png';
import iconMaskable from '../../assets/icons/icon-maskable-512.png';

const THEME = '#090617';

// Browser identity for every page: tab icon, touch icon, pinned tab and a
// web app manifest. Webpack hashes the image URLs, so the manifest is built
// here at runtime rather than shipped as a static file.
export function installIcons({ name = 'AM Arcade', description = 'Walk the floor of a neon arcade and play the machines.' } = {}) {
    const head = document.head;
    const link = (attrs) => {
        const el = document.createElement('link');
        for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
        head.appendChild(el);
    };
    link({ rel: 'icon', href: faviconIco, sizes: '16x16 32x32 48x48' });
    link({ rel: 'icon', type: 'image/svg+xml', href: faviconSvg });
    link({ rel: 'icon', type: 'image/png', sizes: '32x32', href: favicon32 });
    link({ rel: 'icon', type: 'image/png', sizes: '16x16', href: favicon16 });
    link({ rel: 'apple-touch-icon', sizes: '180x180', href: appleTouch });
    link({ rel: 'mask-icon', href: pinnedTab, color: '#00e5ff' });

    const meta = document.createElement('meta');
    meta.name = 'theme-color';
    meta.content = THEME;
    head.appendChild(meta);

    const manifest = {
        name,
        short_name: name,
        description,
        // A blob manifest has no base URL, so every URL in it must be absolute.
        start_url: location.origin + location.pathname,
        display: 'fullscreen',
        orientation: 'landscape',
        background_color: THEME,
        theme_color: THEME,
        icons: [
            { src: new URL(icon192, location.href).href, sizes: '192x192', type: 'image/png' },
            { src: new URL(icon512, location.href).href, sizes: '512x512', type: 'image/png' },
            { src: new URL(iconMaskable, location.href).href, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
    };
    const blob = new Blob([JSON.stringify(manifest)], { type: 'application/manifest+json' });
    link({ rel: 'manifest', href: URL.createObjectURL(blob) });
}
