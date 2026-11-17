'use strict';
const http=require('node:http');const {URL}=require('node:url');const {equalToken,validSignature,parseIncoming}=require('./whatsapp.cjs');
function createServer(config,gateway,store){return http.createServer((req,res)=>{
 const finish=(status,body)=>{res.writeHead(status,{'content-type':'text/plain; charset=utf-8','cache-control':'no-store'});res.end(body)};
 const pathname=new URL(req.url||'/', 'http://localhost').pathname;
 if(req.method==='GET'&&pathname==='/health'){return finish(200,'OK')}
 if(pathname!=='/webhook/whatsapp')return finish(404,'not found');
 if(req.method==='GET'){
 const q=new URL(req.url,'http://localhost').searchParams;
 if(q.get('hub.mode')==='subscribe'&&equalToken(q.get('hub.verify_token'),config.verifyToken)&&q.get('hub.challenge'))return finish(200,q.get('hub.challenge'));
 return finish(403,'verification failed');
 }
 if(req.method!=='POST')return finish(405,'method not allowed');
 let size=0,chunks=[],tooLarge=false;req.on('data',c=>{size+=c.length;if(size>512*1024){if(!tooLarge){tooLarge=true;finish(413,'payload too large')}return}chunks.push(c)});req.on('end',()=>{
 if(tooLarge)return;const raw=Buffer.concat(chunks);
 if(!validSignature(raw,req.headers['x-hub-signature-256'],config.appSecret))return finish(401,'invalid signature');
 let j;try{j=JSON.parse(raw.toString('utf8'))}catch{return finish(400,'invalid json')}
 try{for(const m of parseIncoming(j,config.phoneNumberId)){gateway.receive(m.id,m.wa,m.text)}}catch{return finish(500,'processing error')}
 return finish(200,'EVENT_RECEIVED');
 });req.on('error',()=>{});
 })}
module.exports={createServer};
