import type { Metadata } from 'next';
import './globals.css';
export const metadata:Metadata={title:'MentApp — Make time for your people',description:'Less back and forth. More getting together. Plan your next hangout with one shared link.',robots:{index:false,follow:false}};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>;}
