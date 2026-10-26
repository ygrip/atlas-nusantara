export type LayerId = 'warnings' | 'earthquakes' | 'history' | 'hazards';
export type AtlasLayer = { id: LayerId; source: string; status: 'planned' | 'ready'; coverage: 'national' | 'regional'; cadence: string; url: string };
/** No live incidents or warnings are represented by this initial manifest. */
export const layers: AtlasLayer[] = [
 {id:'warnings',source:'BMKG CAP',status:'planned',coverage:'regional',cadence:'5 min polling target',url:'https://www.bmkg.go.id/'},
 {id:'earthquakes',source:'BMKG',status:'planned',coverage:'national',cadence:'2–5 min polling target',url:'https://data.bmkg.go.id/gempabumi/'},
 {id:'history',source:'BNPB Satu Data',status:'planned',coverage:'regional',cadence:'publication-driven',url:'https://data.bnpb.go.id/'},
 {id:'hazards',source:'BNPB InaRISK',status:'planned',coverage:'regional',cadence:'versioned static data',url:'https://inarisk.bnpb.go.id/'}
];
