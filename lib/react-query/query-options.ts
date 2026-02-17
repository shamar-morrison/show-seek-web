const baseQueryOptions = {
  refetchOnWindowFocus: false,
  refetchOnReconnect: false,
  refetchOnMount: false,
} as const

export const queryCacheProfiles = {
  status: {
    ...baseQueryOptions,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  },
  profile: {
    ...baseQueryOptions,
    staleTime: 30 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
  },
} as const
