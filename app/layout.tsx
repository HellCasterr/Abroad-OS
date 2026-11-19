import type { Metadata } from 'next';
import './globals.css';
import './chat.css';

export const metadata: Metadata = {title:'AbroadOS · Admissions command center',description:'A private command center for admissions, funding, and deadlines',robots:{index:false,follow:false}};
export default function RootLayout({children}:{children:React.ReactNode}) {return <html lang="en"><body>{children}</body></html>;}
