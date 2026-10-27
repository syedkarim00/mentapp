import { ZodError } from 'zod';
import { DomainError } from './domain';
import { StoreError } from './store';
export async function body(request:Request){if(Number(request.headers.get('content-length')||0)>16000)throw new StoreError('Request is too large.',413);const text=await request.text();if(new TextEncoder().encode(text).length>16000)throw new StoreError('Request is too large.',413);try{return JSON.parse(text);}catch{throw new StoreError('Invalid request.',400);}}
export function sameOrigin(request:Request){
 const origin=request.headers.get('origin');
 if(!origin)return;
 try{
  const source=new URL(origin);
  // Next.js may use its internal hostname in request.url. Host preserves the
  // public authority the browser addressed, including the development port.
  const host=request.headers.get('host')||new URL(request.url).host;
  if(source.host===host&&(source.protocol==='https:'||(process.env.NODE_ENV!=='production'&&source.protocol==='http:')))return;
 }catch{/* reject malformed origins */}
 throw new StoreError('Request origin not allowed.',403);
}
export function failure(error:unknown){if(error instanceof ZodError)return Response.json({error:error.issues[0]?.message||'Invalid input.'},{status:400});if(error instanceof DomainError)return Response.json({error:error.message},{status:400});if(error instanceof StoreError)return Response.json({error:error.message},{status:error.status});return Response.json({error:'The service is temporarily unavailable. Please try again.'},{status:503});}
