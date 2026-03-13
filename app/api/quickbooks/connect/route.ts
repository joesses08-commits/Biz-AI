import { NextResponse } from 'next/server';

export async function GET() {
  const clientId = process.env.QUICKBOOKS_CLIENT_ID!;
  const redirectUri = process.env.QUICKBOOKS_REDIRECT_URI!;
  
  const scope = 'com.intuit.quickbooks.accounting';
  const state = Math.random().toString(36).substring(7);
  
  const authUrl = new URL('https://appcenter.intuit.com/connect/oauth2');
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', scope);
  authUrl.searchParams.set('state', state);
  
  return NextResponse.redirect(authUrl.toString());
}
