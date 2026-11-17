'use strict';
const crypto=require('node:crypto');
function equalToken(a,b){const aa=Buffer.from(String(a||''));const bb=Buffer.from(String(b||''));return aa.length===bb.length && crypto.timingSafeEqual(aa,bb)}
function validSignature(body,header,secret){if(typeof header!=='string'||!/^sha256=[a-f0-9]{64}$/i.test(header))return false;const expected='sha256='+crypto.createHmac('sha256',secret).update(body).digest('hex');return equalToken(header.toLowerCase(),expected)}
function parseIncoming(p,phoneNumberId){if(!p || p.object!=='whatsapp_business_account'||!Array.isArray(p.entry))return [];
 const out=[];for(const e of p.entry)for(const c of (e.changes||[])){
  if(c.field!=='messages')continue;const v=c.value||{};
  if(phoneNumberId && String(v.metadata?.phone_number_id)!==String(phoneNumberId))continue;
  for(const m of (v.messages||[])){
   if(m.group_id||m.context?.group_id)continue; // Somente conversas individuais no laboratório
   const id=m.id,wa=m.from;
   if(!/^wamid\./.test(String(id))||!/^[1-9][0-9]{7,15}$/.test(String(wa)))continue;
   let text='';if(m.type==='text')text=m.text?.body||'';
   else if(m.type==='interactive')text=m.interactive?.button_reply?.id || m.interactive?.list_reply?.id||'';
   else if(m.type==='button')text=m.button?.payload||'';
   if(typeof text==='string'&&text.length<=4000&&text.trim())out.push({id,wa,text:text.trim()});
  }
 }
 return out;
}
function makeSender(config,post=globalThis.fetch){return async (wa,text)=>{
 if(config.mode==='mock'){process.stdout.write('[SIMULAÇÃO] Resposta preparada para jogador autorizado; '+text.length+' caracteres.\n');return {mock:true}}
 const url=`https://graph.facebook.com/${config.graphVersion}/${config.phoneNumberId}/messages`;
 const ac=new AbortController();const timer=setTimeout(()=>ac.abort(),15000);
 try{const r=await post(url,{method:'POST',headers:{Authorization:'Bearer '+config.accessToken,'Content-Type':'application/json'},body:JSON.stringify({messaging_product:'whatsapp',recipient_type:'individual',to:wa,type:'text',text:{preview_url:false,body:text}}),signal:ac.signal});
 const response=await r.json().catch(()=>({}));
 if(!r.ok){const err=new Error('Envio WhatsApp falhou: HTTP '+r.status+'; código '+(response.error?.code||'indisponível'));err.retryable=r.status===429||r.status>=500;throw err}
 return response;
 }finally{clearTimeout(timer)}
}}
module.exports={validSignature,equalToken,parseIncoming,makeSender};
