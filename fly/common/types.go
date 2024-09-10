package common

type HeightInfo struct {
	Latest    uint64
	Safe      uint64
	Finalized uint64
}

type GuardianHeight map[string]HeightInfo // map of guardian addr to height info

type GuardianChainHeights map[uint32]GuardianHeight // map of chainIds to guardian heights

type ChainHeights map[uint32]uint64 // map of chainIds to heights
