import type { ChatMessage } from '@/types';

function tokens(text:string){
  return new Set(text.toLowerCase().replace(/[^a-z0-9\s]/g,' ').split(/\s+/).filter(word=>word.length>2));
}
function similarity(a:string,b:string){
  const A=tokens(a),B=tokens(b); if(!A.size||!B.size)return 0;
  let overlap=0; for(const token of A) if(B.has(token)) overlap+=1;
  const union=new Set([...A,...B]).size;
  return union?overlap/union:0;
}

export function repetitionSignal(messages:ChatMessage[],current:string){
  const recent=messages.filter(m=>m.role==='user').slice(-8);
  const matches=recent.filter(m=>similarity(m.text,current)>=0.72);
  if(matches.length<2)return null;
  return 'Strong repetition signal: the user has asked substantially the same question multiple times without clearly adding new evidence. Do not shame or diagnose. If the issue is not safety-critical, briefly note that continued analysis may not add information and offer a choice between a concrete action, tolerating uncertainty, or changing focus.';
}
