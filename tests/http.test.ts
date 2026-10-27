import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sameOrigin } from '../src/lib/http';
test('origin validation uses the public host behind the Next.js server',()=>{
 assert.doesNotThrow(()=>sameOrigin(new Request('http://localhost:3000/api/hangouts',{headers:{host:'mentapp.example',origin:'https://mentapp.example'}})));
 assert.throws(()=>sameOrigin(new Request('http://localhost:3000/api/hangouts',{headers:{host:'mentapp.example',origin:'https://evil.example'}})));
 assert.throws(()=>sameOrigin(new Request('http://localhost:3000/api/hangouts',{headers:{host:'mentapp.example',origin:'null'}})));
});
