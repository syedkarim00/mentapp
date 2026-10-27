import { EventPage } from '@/components/app';
export default async function Page({params}:{params:Promise<{token:string}>}){return <EventPage token={(await params).token}/>;}
