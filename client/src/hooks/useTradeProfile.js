import { useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { getTradeCapabilities } from '../utils/tradeCapabilities';

/**
 * useTradeProfile hook
 *
 * Exposes current tenant trade capabilities, UI feature flags, and localized terminology.
 */
export function useTradeProfile() {
  const { tenant } = useAuth();

  const tradeProfile = useMemo(() => {
    return getTradeCapabilities(tenant?.business_type);
  }, [tenant?.business_type]);

  return {
    ...tradeProfile,
    businessType: tradeProfile.id,
    isFrozenFood: tradeProfile.id === 'frozen_food',
    isPharmacy: tradeProfile.id === 'pharmacy',
    isClothing: tradeProfile.id === 'clothing',
    isRestaurant: tradeProfile.id === 'restaurant',
    isRetailGeneral: tradeProfile.id === 'retail_general',
    isHardware: tradeProfile.id === 'hardware',
    isWholesale: tradeProfile.id === 'wholesale',
    isGrocery: tradeProfile.id === 'grocery'
  };
}

export default useTradeProfile;
