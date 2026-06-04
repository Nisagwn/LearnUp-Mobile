import { useEffect, useState } from 'react';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';

export interface NetworkStatus {
  isConnected: boolean | null;
  isInternetReachable: boolean | null;
}

export function useNetwork(): NetworkStatus {
  const [status, setStatus] = useState<NetworkStatus>({
    isConnected: null,
    isInternetReachable: null,
  });

  useEffect(() => {
    const sub = NetInfo.addEventListener((state: NetInfoState) => {
      setStatus({
        isConnected: state.isConnected,
        isInternetReachable: state.isInternetReachable,
      });
    });
    NetInfo.fetch().then((state) =>
      setStatus({
        isConnected: state.isConnected,
        isInternetReachable: state.isInternetReachable,
      }),
    );
    return () => sub();
  }, []);

  return status;
}
