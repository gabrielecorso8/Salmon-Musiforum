import type { Metadata } from 'next';
export const metadata: Metadata = {title:'Salmon · MusiForum', description:'Il MusiForum di Salmon Magazine',icons:{icon:'/salmon-icon-v3.png',apple:'/salmon-apple-icon-v3.png'}};
export default function RootLayout({children}:{children:React.ReactNode}) {return <html lang="it"><body>{children}</body></html>}
