import React from 'react';
import { PopupContainer } from '@components/popup/container';
import { Box, Text, Button } from '@stacks/ui';
import { useLoadable } from '@common/hooks/use-loadable';
import {
  contractSourceStore,
  contractInterfaceStore,
  pendingTransactionFunctionSelector,
  signedTransactionStore,
  pendingTransactionStore,
} from '@store/recoil/transaction';
import { accountDataStore, chainInfoStore } from '@store/recoil/api';
import { useRecoilValue } from 'recoil';

const openGithubIssue = (loadable: ReturnType<typeof useLoadable>) => {
  const issueParams = new URLSearchParams();
  const issueTitle = `[${VERSION}] Bug: <describe issue>`;
  const issueLabels = 'bug,reported-from-ui';
  const error = loadable.errorOrThrow();
  const issueBody = `
<!--
  Thanks for creating an issue. Please include as much detail as possible,
  including screenshots, operating system, browser, and steps to recreate.
-->

Bug found testing Stacks Wallet for Web.

### Error

**Loadable**: \`${loadable.key}\`
**Message**: \`${error}\`

### Environment

**Version**: \`${VERSION}\`
**Branch**: \`${BRANCH}\`
**Commit**: \`${COMMIT_SHA}\`
`;

  issueParams.set('title', issueTitle);
  issueParams.set('labels', issueLabels);
  issueParams.set('body', issueBody);

  window.open(`https://github.com/blockstack/ux/issues/new?${String(issueParams)}`, '_blank');
};

/**
 * `ErrorBoundary` will look at all of our Recoil loadables and check to see if there is an error.
 * This catches a good chunk of common errors relating to network issues, both for the home page,
 * as well as various transaction pages.
 *
 * `ErrorBoundary` is wrapped around every child component. If an error is found, it renders an error page.
 * If not, then the child is rendered as usual.
 *
 */
export const ErrorBoundary: React.FC = ({ children }) => {
  const pendingTransaction = useRecoilValue(pendingTransactionStore);
  const loadables: ReturnType<typeof useLoadable>[] = [
    useLoadable(chainInfoStore),
    useLoadable(accountDataStore),
  ];

  if (pendingTransaction) {
    loadables.push(useLoadable(contractSourceStore));
    loadables.push(useLoadable(contractInterfaceStore));
    loadables.push(useLoadable(pendingTransactionFunctionSelector));
    loadables.push(useLoadable(signedTransactionStore));
  }

  const errorLoadables = loadables.filter(loadable => loadable.errorMaybe());

  if (errorLoadables.length > 0) {
    const [loadable] = errorLoadables;
    const error = errorLoadables[0].errorOrThrow();
    return (
      <PopupContainer title="Uh oh! Something went wrong.">
        <Box my="extra-loose">
          <Text fontSize={2} fontFamily="mono">
            {String(error)}
          </Text>
        </Box>
        <Box>
          <Text fontSize={2} fontWeight="500">
            Version:
          </Text>
          <Text fontSize={2} ml="tight" fontFamily="mono">
            {VERSION}
          </Text>
        </Box>
        <Box>
          <Text fontSize={2} fontWeight="500">
            Branch:
          </Text>
          <Text fontSize={2} ml="tight" fontFamily="mono">
            {BRANCH}
          </Text>
        </Box>
        <Box>
          <Text fontSize={2} fontWeight="500">
            Commit:
          </Text>
          <Text fontSize={2} ml="tight" fontFamily="mono">
            {COMMIT_SHA}
          </Text>
        </Box>
        <Box my="extra-loose">
          <Text fontSize={2}>
            If you believe this was caused by a bug in our code, please file an issue on Github.
          </Text>
        </Box>
        <Box mt="extra-loose" mb="base">
          <Button width="100%" onClick={() => openGithubIssue(loadable)}>
            File an issue
          </Button>
        </Box>
      </PopupContainer>
    );
  }

  return <>{children}</>;
};
