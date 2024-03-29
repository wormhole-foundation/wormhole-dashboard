package common

import "strings"

// Guardian address to index map
var guardianIndexMap = map[string]int{
	strings.ToLower("0xfF6CB952589BDE862c25Ef4392132fb9D4A42157"): 1,
	strings.ToLower("0x114De8460193bdf3A2fCf81f86a09765F4762fD1"): 2,
	strings.ToLower("0x107A0086b32d7A0977926A205131d8731D39cbEB"): 3,
	strings.ToLower("0x8C82B2fd82FaeD2711d59AF0F2499D16e726f6b2"): 4,
	strings.ToLower("0x11b39756C042441BE6D8650b69b54EbE715E2343"): 5,
	strings.ToLower("0x54Ce5B4D348fb74B958e8966e2ec3dBd4958a7cd"): 6,
	strings.ToLower("0x15e7cAF07C4e3DC8e7C469f92C8Cd88FB8005a20"): 7,
	strings.ToLower("0x74a3bf913953D695260D88BC1aA25A4eeE363ef0"): 8,
	strings.ToLower("0x000aC0076727b35FBea2dAc28fEE5cCB0fEA768e"): 9,
	strings.ToLower("0xAF45Ced136b9D9e24903464AE889F5C8a723FC14"): 10,
	strings.ToLower("0xf93124b7c738843CBB89E864c862c38cddCccF95"): 11,
	strings.ToLower("0xD2CC37A4dc036a8D232b48f62cDD4731412f4890"): 12,
	strings.ToLower("0xDA798F6896A3331F64b48c12D1D57Fd9cbe70811"): 13,
	strings.ToLower("0x71AA1BE1D36CaFE3867910F99C09e347899C19C3"): 14,
	strings.ToLower("0x8192b6E7387CCd768277c17DAb1b7a5027c0b3Cf"): 15,
	strings.ToLower("0x178e21ad2E77AE06711549CFBB1f9c7a9d8096e8"): 16,
	strings.ToLower("0x5E1487F35515d02A92753504a8D75471b9f49EdB"): 17,
	strings.ToLower("0x6FbEBc898F403E4773E95feB15E80C9A99c8348d"): 18,
	strings.ToLower("0x5893B5A76c3f739645648885bDCcC06cd70a3Cd3"): 19,
}

var guardianIndexToNameMap = map[int]string{
	1:  "Staked",
	2:  "Figment",
	3:  "ChainodeTech",
	4:  "Inotel",
	5:  "HashQuark",
	6:  "ChainLayer",
	7:  "xLabs",
	8:  "Forbole",
	9:  "Staking Fund",
	10: "MoonletWallet",
	11: "P2P Validator",
	12: "01node",
	13: "MCF-V2-MAINNET",
	14: "Everstake",
	15: "Chorus One",
	16: "syncnode",
	17: "Triton",
	18: "Staking Facilities",
	19: "RockawayX",
	20: "Totals:",
}

func GetGuardianName(addr string) (string, bool) {
	name, ok := guardianIndexToNameMap[guardianIndexMap[strings.ToLower(addr)]]
	return name, ok
}

func GetGuardianIndexToNameMap() map[int]string {
	return guardianIndexToNameMap
}
