import { makeDIDFromAddress } from '@stacks/auth';
import { makeUUID4, nextMonth } from '@stacks/common';
import { publicKeyToBtcAddress } from '@stacks/encryption';
import base64url from 'base64url';

export async function makeLedgerCompatibleUnsignedAuthResponsePayload({
  dataPublicKey,
  profile = {},
  expiresAt = nextMonth().getTime(),
  encrytpedAppPrivateKey = null,
}: {
  dataPublicKey: string;
  profile: any;
  expiresAt?: number;
  encrytpedAppPrivateKey?: string | null;
}): Promise<string> {
  const address = publicKeyToBtcAddress(dataPublicKey);

  const payload = {
    jti: makeUUID4(),
    iat: Math.floor(new Date().getTime() / 1000), // JWT times are in seconds
    exp: Math.floor(expiresAt / 1000), // JWT times are in seconds
    iss: makeDIDFromAddress(address),
    private_key: encrytpedAppPrivateKey,
    public_keys: [dataPublicKey],
    profile,
  };

  const header = { typ: 'JWT', alg: 'ES256K' };

  const formedHeader = base64url.encode(JSON.stringify(header));

  const formedPayload = base64url.encode(JSON.stringify(payload));

  const inputToSign = [formedHeader, formedPayload].join('.');

  return inputToSign;
}
