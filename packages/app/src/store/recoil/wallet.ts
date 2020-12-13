import { atom, selector, atomFamily } from 'recoil';
import { localStorageEffect } from './index';
import { Wallet } from '@stacks/keychain';
import { currentNetworkKeyStore } from './networks';

export const secretKeyStore = atom<string | undefined>({
  key: 'wallet.secret-key',
  default: undefined,
  effects_UNSTABLE: [localStorageEffect()],
});

export const hasSetPasswordStore = atom<boolean>({
  key: 'wallet.has-set-password',
  default: false,
  effects_UNSTABLE: [localStorageEffect()],
});

export const walletStore = atom<Wallet | undefined>({
  key: 'wallet.wallet',
  default: undefined,
  effects_UNSTABLE: [
    localStorageEffect({
      serialize: wallet => {
        if (!wallet) return '';
        return JSON.stringify(wallet);
      },
      deserialize: walletJSON => {
        if (!walletJSON) return undefined;
        return new Wallet(JSON.parse(walletJSON));
      },
    }),
  ],
  dangerouslyAllowMutability: true,
});

/**
 * Map from {network, stxAddress} to latest nonce sent from this device
 */
export const latestNoncesStore = atomFamily<
  { nonce: number; blockHeight: number },
  [string, string]
>({
  key: 'wallet.latest-nonces',
  default: args => {
    const key = `wallet.latest-nonces__${JSON.stringify(args)}`;
    const current = localStorage.getItem(key);
    if (current) {
      return JSON.parse(current);
    }
    return {
      nonce: 0,
      blockHeight: 0,
    };
  },
  effects_UNSTABLE: [localStorageEffect()],
});

export const latestNonceStore = selector({
  key: 'wallet.latest-nonce',
  get: ({ get }) => {
    const network = get(currentNetworkKeyStore);
    const currentIdentity = get(currentIdentityStore);
    const nonce = get(latestNoncesStore([network, currentIdentity?.getStxAddress() || '']));
    return nonce;
  },
});

export const currentIdentityIndexStore = atom<number | undefined>({
  key: 'wallet.current-identity-index',
  default: undefined,
  effects_UNSTABLE: [localStorageEffect()],
});

export const encryptedSecretKeyStore = atom<string | undefined>({
  key: 'wallet.encrypted-key',
  default: undefined,
  effects_UNSTABLE: [localStorageEffect()],
});

export const currentIdentityStore = selector({
  key: 'wallet.current-identity',
  get: ({ get }) => {
    const identityIndex = get(currentIdentityIndexStore);
    const wallet = get(walletStore);
    if (identityIndex === undefined || !wallet) {
      return undefined;
    }
    return wallet.identities[identityIndex];
  },
  dangerouslyAllowMutability: true,
});
