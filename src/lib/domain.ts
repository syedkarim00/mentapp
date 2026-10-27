import { z } from 'zod';
import { fromZonedTime, formatInTimeZone } from 'date-fns-tz';

const text = (max:number) => z.string().trim().min(1).max(max);
export const timezone = text(100).refine(v=>{try{new Intl.DateTimeFormat('en',{timeZone:v});return true;}catch{return false;}}, 'Choose a valid timezone');
export const createSchema = z.object({title:text(100),description:z.string().trim().max(2000).default(''),timezone,dates:z.array(text(30)).min(1).max(20),places:z.array(text(160)).min(1).max(20)});
export const actionSchema = z.discriminatedUnion('type',[
 z.object({type:z.literal('vote'),name:text(50),optionId:text(50),value:z.enum(['yes','maybe','no'])}),
 z.object({type:z.literal('rsvp'),name:text(50),value:z.enum(['going','maybe','no'])}),
 z.object({type:z.literal('option'),kind:z.enum(['date','place']),value:text(160)}),
 z.object({type:z.literal('finalize'),dateId:text(50),placeId:text(50)}),
 z.object({type:z.literal('reopen')}),z.object({type:z.literal('cancel')}),
 z.object({type:z.literal('edit'),title:text(100),description:z.string().trim().max(2000)}),
 z.object({type:z.literal('comment'),name:text(50),body:text(2000)}),
 z.object({type:z.literal('deleteComment'),id:text(50)})
]);
export type Action = z.infer<typeof actionSchema>;
export type Option = {id:string;kind:'date'|'place';value:string};
export type Participant = {id:string;name:string;key:string;votes:Record<string,'yes'|'maybe'|'no'>;rsvp?:'going'|'maybe'|'no';rsvpRevision?:number};
export type Hangout = {id:string;title:string;description:string;timezone:string;createdAt:string;status:'planning'|'finalized'|'cancelled';options:Option[];participants:Participant[];comments:{id:string;name:string;body:string;createdAt:string}[];final?:{dateId:string;placeId:string};revision:number;calendarSequence:number};
export class DomainError extends Error {}
export function localToUTC(value:string,tz:string) {
 if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) throw new DomainError('Enter a valid date and time.');
 const date=fromZonedTime(value,tz);
 if(!Number.isFinite(date.getTime()) || formatInTimeZone(date,tz,"yyyy-MM-dd'T'HH:mm")!==value) throw new DomainError('That local time does not exist. Choose another time.');
 return date.toISOString();
}
export function createHangout(input:z.infer<typeof createSchema>):Hangout {
 const data=createSchema.parse(input);
 const options:Option[]=[
  ...[...new Set(data.dates.map(d=>localToUTC(d,data.timezone)))].map(value=>({id:crypto.randomUUID(),kind:'date' as const,value})),
  ...[...new Set(data.places)].map(value=>({id:crypto.randomUUID(),kind:'place' as const,value}))
 ];
 return {id:crypto.randomUUID(),title:data.title,description:data.description,timezone:data.timezone,createdAt:new Date().toISOString(),status:'planning',options,participants:[],comments:[],revision:0,calendarSequence:0};
}
export function applyAction(original:Hangout,raw:Action):Hangout {
 const action=actionSchema.parse(raw), h=structuredClone(original);
 if(h.status==='cancelled') throw new DomainError('This hangout has been cancelled.');
 const participant=(name:string)=>{const key=name.normalize('NFKC').toLocaleLowerCase('en').replace(/\s+/g,' ').trim();let p=h.participants.find(p=>p.key===key);if(!p){if(h.participants.length>=100)throw new DomainError('This hangout has reached 100 participants.');p={id:crypto.randomUUID(),name,key,votes:{}};h.participants.push(p);}return p;};
 switch(action.type){
 case 'vote': if(h.status!=='planning')throw new DomainError('Voting is closed.');if(!h.options.some(o=>o.id===action.optionId))throw new DomainError('Option not found.');participant(action.name).votes[action.optionId]=action.value;break;
 case 'rsvp':if(h.status!=='finalized')throw new DomainError('Finalize the plan before RSVPing.');Object.assign(participant(action.name),{rsvp:action.value,rsvpRevision:h.revision});break;
 case 'option':{if(h.status!=='planning')throw new DomainError('Reopen voting to add options.');if(h.options.filter(o=>o.kind===action.kind).length>=20)throw new DomainError('Maximum 20 options of each kind.');const value=action.kind==='date'?localToUTC(action.value,h.timezone):action.value;if(h.options.some(o=>o.kind===action.kind&&o.value===value))throw new DomainError('That option already exists.');h.options.push({id:crypto.randomUUID(),kind:action.kind,value});break;}
 case 'finalize':if(h.status!=='planning')throw new DomainError('Reopen voting before changing the plan.');if(!h.options.some(o=>o.kind==='date'&&o.id===action.dateId)||!h.options.some(o=>o.kind==='place'&&o.id===action.placeId))throw new DomainError('Choose a date and a place.');if(!h.final||h.final.dateId!==action.dateId||h.final.placeId!==action.placeId)h.revision++;h.final={dateId:action.dateId,placeId:action.placeId};h.status='finalized';h.calendarSequence++;break;
 case 'reopen':h.status='planning';break;
 case 'cancel':h.status='cancelled';h.calendarSequence++;break;
 case 'edit':h.title=action.title;h.description=action.description;h.calendarSequence++;break;
 case 'comment':if(h.comments.length>=500)throw new DomainError('This hangout has reached its comment limit.');h.comments.push({id:crypto.randomUUID(),name:action.name,body:action.body,createdAt:new Date().toISOString()});break;
 case 'deleteComment':h.comments=h.comments.filter(c=>c.id!==action.id);break;
 }
 return h;
}
export const dateLabel=(value:string,tz:string)=>new Intl.DateTimeFormat('en',{timeZone:tz,weekday:'short',month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'}).format(new Date(value));
const escapeICS=(s:string)=>s.replace(/\\/g,'\\\\').replace(/\r?\n/g,'\\n').replace(/;/g,'\\;').replace(/,/g,'\\,');
const stamp=(s:string)=>s.replace(/[-:]/g,'').replace(/\.\d{3}/,'');
export function calendar(h:Hangout) {
 if(h.status!=='finalized'||!h.final)throw new DomainError('Only finalized hangouts can be exported.');
 const start=h.options.find(o=>o.id===h.final!.dateId)!.value,place=h.options.find(o=>o.id===h.final!.placeId)!.value;
 const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//MentApp//Hangouts//EN','CALSCALE:GREGORIAN','BEGIN:VEVENT',`UID:${h.id}@mentapp`,`DTSTAMP:${stamp(new Date().toISOString())}`,`DTSTART:${stamp(start)}`,`DTEND:${stamp(new Date(Date.parse(start)+7200000).toISOString())}`,`SEQUENCE:${h.calendarSequence}`,`SUMMARY:${escapeICS(h.title)}`,`DESCRIPTION:${escapeICS(h.description)}`,`LOCATION:${escapeICS(place)}`,'END:VEVENT','END:VCALENDAR'];
 return lines.map(line=>{let result='',bytes=0;for(const ch of line){const n=new TextEncoder().encode(ch).length;if(bytes+n>75){result+='\r\n ';bytes=1;}result+=ch;bytes+=n;}return result;}).join('\r\n')+'\r\n';
}
