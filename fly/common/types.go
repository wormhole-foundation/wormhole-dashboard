package common

type GuardianHeight map[string]uint64 // map of guardian addr to chain height

type GuardianChainHeights map[uint32]GuardianHeight // map of chainIds to guardian heights

type ChainHeights map[uint32]uint64 // map of chainIds to heights
