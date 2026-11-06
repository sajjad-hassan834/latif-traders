import { useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { getTradeCapabilities } from '../utils/tradeCapabilities';

/**
 * useTradeProfile hook
 *
 * Exposes current tenant trade capabilities, UI feature flags, and localized terminology.
 * Defaults safely to retail_general if tenant context is unassigned.
 */
export function useTradeProfile() {
  const { tenant } = useAuth();

  const businessType = tenant?.business_type || 'retail_general';

  const tradeProfile = useMemo(() => {
    return getTradeCapabilities(businessType);
  }, [businessType]);

  return {
    ...tradeProfile,
    businessType,
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
