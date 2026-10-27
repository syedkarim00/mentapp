import { createClient } from '@supabase/supabase-js';
import { createHash, randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import path from 'node:path';
import { applyAction, type Action, type Hangout } from './domain';

const root=path.join(process.cwd(),'.local-data');
const hash=(value:string)=>createHash('sha256').update(value).digest('hex');
const valid=(token:string)=>/^[a-f0-9]{64}$/.test(token);
const client=()=>process.env.SUPABASE_URL&&process.env.SUPABASE_SECRET_KEY?createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SECRET_KEY,{auth:{persistSession:false,autoRefreshToken:false}}):null;
function localAllowed(){if(process.env.NODE_ENV==='production')throw new Error('Database is not configured');}
type Row={state:Hangout;version:number};
export class StoreError extends Error {constructor(message:string,public status:number){super(message);}}
async function read(token:string):Promise<Row>{
 if(!valid(token))throw new StoreError('Hangout not found.',404);
 const db=client();if(db){const {data,error}=await db.from('hangouts').select('state,version').eq('token_hash',hash(token)).maybeSingle();if(error)throw new Error('Database request failed');if(!data)throw new StoreError('Hangout not found.',404);return data as Row;}
 localAllowed();try{return JSON.parse(await readFile(path.join(root,hash(token)+'.json'),'utf8'));}catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')throw new StoreError('Hangout not found.',404);throw e;}
}
export const getHangout=async(token:string)=>(await read(token)).state;
export async function saveNew(state:Hangout){const token=randomBytes(32).toString('hex');const db=client();if(db){const {error}=await db.from('hangouts').insert({token_hash:hash(token),state,version:0});if(error)throw new Error('Could not save hangout');}else{localAllowed();await mkdir(root,{recursive:true});await writeFile(path.join(root,hash(token)+'.json'),JSON.stringify({state,version:0}));}return token;}
let queue=Promise.resolve();
export async function mutate(token:string,action:Action):Promise<Hangout>{
 const db=client();
 if(db){for(let attempt=0;attempt<8;attempt++){const current=await read(token);const state=applyAction(current.state,action);const {data,error}=await db.from('hangouts').update({state,version:current.version+1}).eq('token_hash',hash(token)).eq('version',current.version).select('version');if(error)throw new Error('Could not save changes');if(data?.length)return state;}throw new StoreError('Lots of activity right now. Please try again.',409);}
 localAllowed();let resolve!:()=>void;const previous=queue;queue=new Promise<void>(r=>resolve=r);await previous;
 try{const current=await read(token),state=applyAction(current.state,action),file=path.join(root,hash(token)+'.json');await writeFile(file+'.tmp',JSON.stringify({state,version:current.version+1}));await rename(file+'.tmp',file);return state;}finally{resolve();}
}
const buckets=new Map<string,{count:number;until:number}>();
export async function rateLimit(request:Request,creation=false){
 const ip=process.env.VERCEL?request.headers.get('x-vercel-forwarded-for')?.split(',')[0]||'unknown':'local';
 const key=hash(`${creation?'create':'write'}:${ip}`),limit=creation?20:180;
 const db=client();if(db){const {data,error}=await db.rpc('mentapp_rate_limit',{bucket_key:key,max_requests:limit});if(error)throw new Error('Rate limit service unavailable');if(!data)throw new StoreError('Please wait a minute before trying again.',429);return;}
 localAllowed();const now=Date.now();for(const [key,value] of buckets)if(value.until<now)buckets.delete(key);const bucket=buckets.get(key)||{count:0,until:now+60000};bucket.count++;buckets.set(key,bucket);if(bucket.count>limit)throw new StoreError('Please wait a minute before trying again.',429);
}
