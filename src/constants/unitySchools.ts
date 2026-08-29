/**
 * Canonical List of all 115 Federal Unity Colleges (Unity Schools) in Nigeria (as of 2026).
 * Maintained under the Federal Ministry of Education & USOSA.
 */

export interface UnitySchool {
  id: string;
  name: string;
  shortName: string;
  state: string;
  zone: "North-Central" | "North-East" | "North-West" | "South-East" | "South-South" | "South-West";
  type: "FGC" | "FGGC" | "FSTC" | "Special";
}

export const ALL_115_UNITY_SCHOOLS: UnitySchool[] = [
  // ──────────────────────────────────────────────────────────────────────────
  // NORTH-CENTRAL (24 Schools across Benue, Kogi, Kwara, Nasarawa, Niger, Plateau, FCT Abuja)
  // ──────────────────────────────────────────────────────────────────────────
  { id: "fgc_vandeikya", name: "Federal Government College, Vandeikya", shortName: "FGC Vandeikya", state: "Benue", zone: "North-Central", type: "FGC" },
  { id: "fggc_gboko", name: "Federal Government Girls' College, Gboko", shortName: "FGGC Gboko", state: "Benue", zone: "North-Central", type: "FGGC" },
  { id: "fstc_otukpo", name: "Federal Science and Technical College, Otukpo", shortName: "FSTC Otukpo", state: "Benue", zone: "North-Central", type: "FSTC" },
  { id: "fgc_ugwolawo", name: "Federal Government College, Ugwolawo", shortName: "FGC Ugwolawo", state: "Kogi", zone: "North-Central", type: "FGC" },
  { id: "fggc_kabba", name: "Federal Government Girls' College, Kabba", shortName: "FGGC Kabba", state: "Kogi", zone: "North-Central", type: "FGGC" },
  { id: "fstc_ogugu", name: "Federal Science and Technical College, Ogugu", shortName: "FSTC Ogugu", state: "Kogi", zone: "North-Central", type: "FSTC" },
  { id: "fgc_ilorin", name: "Federal Government College, Ilorin", shortName: "FGC Ilorin", state: "Kwara", zone: "North-Central", type: "FGC" },
  { id: "fggc_omuaran", name: "Federal Government Girls' College, Omu-Aran", shortName: "FGGC Omu-Aran", state: "Kwara", zone: "North-Central", type: "FGGC" },
  { id: "fstc_oro", name: "Federal Science and Technical College, Oro", shortName: "FSTC Oro", state: "Kwara", zone: "North-Central", type: "FSTC" },
  { id: "fgc_keffi", name: "Federal Government College, Keffi", shortName: "FGC Keffi", state: "Nasarawa", zone: "North-Central", type: "FGC" },
  { id: "fggc_keana", name: "Federal Government Girls' College, Keana", shortName: "FGGC Keana", state: "Nasarawa", zone: "North-Central", type: "FGGC" },
  { id: "fstc_doma", name: "Federal Science and Technical College, Doma", shortName: "FSTC Doma", state: "Nasarawa", zone: "North-Central", type: "FSTC" },
  { id: "fgc_minna", name: "Federal Government College, Minna", shortName: "FGC Minna", state: "Niger", zone: "North-Central", type: "FGC" },
  { id: "fgc_newbussa", name: "Federal Government College, New Bussa", shortName: "FGC New Bussa", state: "Niger", zone: "North-Central", type: "FGC" },
  { id: "fggc_bida", name: "Federal Government Girls' College, Bida", shortName: "FGGC Bida", state: "Niger", zone: "North-Central", type: "FGGC" },
  { id: "fstc_shiroro", name: "Federal Science and Technical College, Shiroro", shortName: "FSTC Shiroro", state: "Niger", zone: "North-Central", type: "FSTC" },
  { id: "fgc_jos", name: "Federal Government College, Jos", shortName: "FGC Jos", state: "Plateau", zone: "North-Central", type: "FGC" },
  { id: "fggc_langtang", name: "Federal Government Girls' College, Langtang", shortName: "FGGC Langtang", state: "Plateau", zone: "North-Central", type: "FGGC" },
  { id: "fstc_bukuru", name: "Federal Science and Technical College, Bukuru", shortName: "FSTC Bukuru", state: "Plateau", zone: "North-Central", type: "FSTC" },
  { id: "fgc_rubochi", name: "Federal Government College, Rubochi", shortName: "FGC Rubochi", state: "FCT Abuja", zone: "North-Central", type: "FGC" },
  { id: "fggc_abaji", name: "Federal Government Girls' College, Abaji", shortName: "FGGC Abaji", state: "FCT Abuja", zone: "North-Central", type: "FGGC" },
  { id: "fggc_bwari", name: "Federal Government Girls' College, Bwari", shortName: "FGGC Bwari", state: "FCT Abuja", zone: "North-Central", type: "FGGC" },
  { id: "fstc_orozo", name: "Federal Science and Technical College, Orozo", shortName: "FSTC Orozo", state: "FCT Abuja", zone: "North-Central", type: "FSTC" },
  { id: "fga_suleja", name: "Federal Government Academy, Suleja (Centre for the Gifted)", shortName: "FGA Suleja (Centre for the Gifted)", state: "FCT Abuja", zone: "North-Central", type: "Special" },

  // ──────────────────────────────────────────────────────────────────────────
  // NORTH-EAST (18 Schools across Adamawa, Bauchi, Borno, Gombe, Taraba, Yobe)
  // ──────────────────────────────────────────────────────────────────────────
  { id: "fgc_ganye", name: "Federal Government College, Ganye", shortName: "FGC Ganye", state: "Adamawa", zone: "North-East", type: "FGC" },
  { id: "fggc_yola", name: "Federal Government Girls' College, Yola", shortName: "FGGC Yola", state: "Adamawa", zone: "North-East", type: "FGGC" },
  { id: "fstc_michika", name: "Federal Science and Technical College, Michika", shortName: "FSTC Michika", state: "Adamawa", zone: "North-East", type: "FSTC" },
  { id: "fgc_azare", name: "Federal Government College, Azare", shortName: "FGC Azare", state: "Bauchi", zone: "North-East", type: "FGC" },
  { id: "fggc_bauchi", name: "Federal Government Girls' College, Bauchi", shortName: "FGGC Bauchi", state: "Bauchi", zone: "North-East", type: "FGGC" },
  { id: "fstc_kafinmadaki", name: "Federal Science and Technical College, Kafin Madaki", shortName: "FSTC Kafin Madaki", state: "Bauchi", zone: "North-East", type: "FSTC" },
  { id: "fgc_maiduguri", name: "Federal Government College, Maiduguri", shortName: "FGC Maiduguri", state: "Borno", zone: "North-East", type: "FGC" },
  { id: "fggc_monguno", name: "Federal Government Girls' College, Monguno", shortName: "FGGC Monguno", state: "Borno", zone: "North-East", type: "FGGC" },
  { id: "fstc_lassa", name: "Federal Science and Technical College, Lassa", shortName: "FSTC Lassa", state: "Borno", zone: "North-East", type: "FSTC" },
  { id: "fgc_billiri", name: "Federal Government College, Billiri", shortName: "FGC Billiri", state: "Gombe", zone: "North-East", type: "FGC" },
  { id: "fggc_bajoga", name: "Federal Government Girls' College, Bajoga", shortName: "FGGC Bajoga", state: "Gombe", zone: "North-East", type: "FGGC" },
  { id: "fstc_gombe", name: "Federal Science and Technical College, Gombe", shortName: "FSTC Gombe", state: "Gombe", zone: "North-East", type: "FSTC" },
  { id: "fgc_wukari", name: "Federal Government College, Wukari", shortName: "FGC Wukari", state: "Taraba", zone: "North-East", type: "FGC" },
  { id: "fggc_jalingo", name: "Federal Government Girls' College, Jalingo", shortName: "FGGC Jalingo", state: "Taraba", zone: "North-East", type: "FGGC" },
  { id: "fstc_jalingo", name: "Federal Science and Technical College, Jalingo", shortName: "FSTC Jalingo", state: "Taraba", zone: "North-East", type: "FSTC" },
  { id: "fgc_buniyadi", name: "Federal Government College, Buni Yadi", shortName: "FGC Buni Yadi", state: "Yobe", zone: "North-East", type: "FGC" },
  { id: "fggc_potiskum", name: "Federal Government Girls' College, Potiskum", shortName: "FGGC Potiskum", state: "Yobe", zone: "North-East", type: "FGGC" },
  { id: "fstc_gashua", name: "Federal Science and Technical College, Gashua", shortName: "FSTC Gashua", state: "Yobe", zone: "North-East", type: "FSTC" },

  // ──────────────────────────────────────────────────────────────────────────
  // NORTH-WEST (21 Schools across Jigawa, Kaduna, Kano, Katsina, Kebbi, Sokoto, Zamfara)
  // ──────────────────────────────────────────────────────────────────────────
  { id: "fgc_kiyawa", name: "Federal Government College, Kiyawa", shortName: "FGC Kiyawa", state: "Jigawa", zone: "North-West", type: "FGC" },
  { id: "fggc_kazaure", name: "Federal Government Girls' College, Kazaure", shortName: "FGGC Kazaure", state: "Jigawa", zone: "North-West", type: "FGGC" },
  { id: "fstc_hadejia", name: "Federal Science and Technical College, Hadejia", shortName: "FSTC Hadejia", state: "Jigawa", zone: "North-West", type: "FSTC" },
  { id: "fgc_kaduna", name: "Federal Government College, Kaduna", shortName: "FGC Kaduna", state: "Kaduna", zone: "North-West", type: "FGC" },
  { id: "fggc_zaria", name: "Federal Government Girls' College, Zaria", shortName: "FGGC Zaria", state: "Kaduna", zone: "North-West", type: "FGGC" },
  { id: "fstc_kafanchan", name: "Federal Science and Technical College, Kafanchan", shortName: "FSTC Kafanchan", state: "Kaduna", zone: "North-West", type: "FSTC" },
  { id: "fgc_kano", name: "Federal Government College, Kano", shortName: "FGC Kano", state: "Kano", zone: "North-West", type: "FGC" },
  { id: "fggc_minjibir", name: "Federal Government Girls' College, Minjibir", shortName: "FGGC Minjibir", state: "Kano", zone: "North-West", type: "FGGC" },
  { id: "fstc_ganduje", name: "Federal Science and Technical College, Ganduje", shortName: "FSTC Ganduje", state: "Kano", zone: "North-West", type: "FSTC" },
  { id: "fgc_daura", name: "Federal Government College, Daura", shortName: "FGC Daura", state: "Katsina", zone: "North-West", type: "FGC" },
  { id: "fggc_bakori", name: "Federal Government Girls' College, Bakori", shortName: "FGGC Bakori", state: "Katsina", zone: "North-West", type: "FGGC" },
  { id: "fstc_dayi", name: "Federal Science and Technical College, Dayi", shortName: "FSTC Dayi", state: "Katsina", zone: "North-West", type: "FSTC" },
  { id: "fgc_birninyauri", name: "Federal Government College, Birnin Yauri", shortName: "FGC Birnin Yauri", state: "Kebbi", zone: "North-West", type: "FGC" },
  { id: "fggc_gwandu", name: "Federal Government Girls' College, Gwandu", shortName: "FGGC Gwandu", state: "Kebbi", zone: "North-West", type: "FGGC" },
  { id: "fstc_zuru", name: "Federal Science and Technical College, Zuru", shortName: "FSTC Zuru", state: "Kebbi", zone: "North-West", type: "FSTC" },
  { id: "fgc_sokoto", name: "Federal Government College, Sokoto", shortName: "FGC Sokoto", state: "Sokoto", zone: "North-West", type: "FGC" },
  { id: "fggc_tambuwal", name: "Federal Government Girls' College, Tambuwal", shortName: "FGGC Tambuwal", state: "Sokoto", zone: "North-West", type: "FGGC" },
  { id: "fstc_illela", name: "Federal Science and Technical College, Illela", shortName: "FSTC Illela", state: "Sokoto", zone: "North-West", type: "FSTC" },
  { id: "fgc_anka", name: "Federal Government College, Anka", shortName: "FGC Anka", state: "Zamfara", zone: "North-West", type: "FGC" },
  { id: "fggc_gusau", name: "Federal Government Girls' College, Gusau", shortName: "FGGC Gusau", state: "Zamfara", zone: "North-West", type: "FGGC" },
  { id: "fstc_zurmi", name: "Federal Science and Technical College, Zurmi", shortName: "FSTC Zurmi", state: "Zamfara", zone: "North-West", type: "FSTC" },

  // ──────────────────────────────────────────────────────────────────────────
  // SOUTH-EAST (15 Schools across Abia, Anambra, Ebonyi, Enugu, Imo)
  // ──────────────────────────────────────────────────────────────────────────
  { id: "fgc_ohafia", name: "Federal Government College, Ohafia", shortName: "FGC Ohafia", state: "Abia", zone: "South-East", type: "FGC" },
  { id: "fggc_uturu", name: "Federal Government Girls' College, Uturu", shortName: "FGGC Uturu", state: "Abia", zone: "South-East", type: "FGGC" },
  { id: "fstc_ohanso", name: "Federal Science and Technical College, Ohanso", shortName: "FSTC Ohanso", state: "Abia", zone: "South-East", type: "FSTC" },
  { id: "fgc_nise", name: "Federal Government College, Nise", shortName: "FGC Nise", state: "Anambra", zone: "South-East", type: "FGC" },
  { id: "fggc_onitsha", name: "Federal Government Girls' College, Onitsha", shortName: "FGGC Onitsha", state: "Anambra", zone: "South-East", type: "FGGC" },
  { id: "fstc_awka", name: "Federal Science and Technical College, Awka", shortName: "FSTC Awka", state: "Anambra", zone: "South-East", type: "FSTC" },
  { id: "fgc_okposi", name: "Federal Government College, Okposi", shortName: "FGC Okposi", state: "Ebonyi", zone: "South-East", type: "FGC" },
  { id: "fggc_ezzamgbo", name: "Federal Government Girls' College, Ezzamgbo", shortName: "FGGC Ezzamgbo", state: "Ebonyi", zone: "South-East", type: "FGGC" },
  { id: "fstc_amuzu", name: "Federal Science and Technical College, Amuzu", shortName: "FSTC Amuzu", state: "Ebonyi", zone: "South-East", type: "FSTC" },
  { id: "fgc_enugu", name: "Federal Government College, Enugu", shortName: "FGC Enugu", state: "Enugu", zone: "South-East", type: "FGC" },
  { id: "fggc_lejja", name: "Federal Government Girls' College, Lejja", shortName: "FGGC Lejja", state: "Enugu", zone: "South-East", type: "FGGC" },
  { id: "fstc_nsukka", name: "Federal Science and Technical College, Nsukka", shortName: "FSTC Nsukka", state: "Enugu", zone: "South-East", type: "FSTC" },
  { id: "fgc_okigwe", name: "Federal Government College, Okigwe", shortName: "FGC Okigwe", state: "Imo", zone: "South-East", type: "FGC" },
  { id: "fggc_owerri", name: "Federal Government Girls' College, Owerri", shortName: "FGGC Owerri", state: "Imo", zone: "South-East", type: "FGGC" },
  { id: "fstc_dikenafai", name: "Federal Science and Technical College, Dikenafai", shortName: "FSTC Dikenafai", state: "Imo", zone: "South-East", type: "FSTC" },

  // ──────────────────────────────────────────────────────────────────────────
  // SOUTH-SOUTH (18 Schools across Akwa Ibom, Bayelsa, Cross River, Delta, Edo, Rivers)
  // ──────────────────────────────────────────────────────────────────────────
  { id: "fgc_ikotekpene", name: "Federal Government College, Ikot Ekpene", shortName: "FGC Ikot-Ekpene", state: "Akwa Ibom", zone: "South-South", type: "FGC" },
  { id: "fggc_ikotabasi", name: "Federal Government Girls' College, Ikot Abasi", shortName: "FGGC Ikot Abasi", state: "Akwa Ibom", zone: "South-South", type: "FGGC" },
  { id: "fstc_uyo", name: "Federal Science and Technical College, Uyo", shortName: "FSTC Uyo", state: "Akwa Ibom", zone: "South-South", type: "FSTC" },
  { id: "fgc_odi", name: "Federal Government College, Odi", shortName: "FGC Odi", state: "Bayelsa", zone: "South-South", type: "FGC" },
  { id: "fggc_imiringi", name: "Federal Government Girls' College, Imiringi", shortName: "FGGC Imiringi", state: "Bayelsa", zone: "South-South", type: "FGGC" },
  { id: "fstc_tungbo", name: "Federal Science and Technical College, Tungbo", shortName: "FSTC Tungbo", state: "Bayelsa", zone: "South-South", type: "FSTC" },
  { id: "fgc_ikom", name: "Federal Government College, Ikom", shortName: "FGC Ikom", state: "Cross River", zone: "South-South", type: "FGC" },
  { id: "fggc_calabar", name: "Federal Government Girls' College, Calabar", shortName: "FGGC Calabar", state: "Cross River", zone: "South-South", type: "FGGC" },
  { id: "fstc_obubra", name: "Federal Science and Technical College, Obubra", shortName: "FSTC Obubra", state: "Cross River", zone: "South-South", type: "FSTC" },
  { id: "fgc_warri", name: "Federal Government College, Warri", shortName: "FGC Warri", state: "Delta", zone: "South-South", type: "FGC" },
  { id: "fggc_ibusa", name: "Federal Government Girls' College, Ibusa", shortName: "FGGC Ibusa", state: "Delta", zone: "South-South", type: "FGGC" },
  { id: "fstc_ogwashiuku", name: "Federal Science and Technical College, Ogwashi-Uku", shortName: "FSTC Ogwashi-Uku", state: "Delta", zone: "South-South", type: "FSTC" },
  { id: "fgc_ibillo", name: "Federal Government College, Ibillo", shortName: "FGC Ibillo", state: "Edo", zone: "South-South", type: "FGC" },
  { id: "fggc_benin", name: "Federal Government Girls' College, Benin", shortName: "FGGC Benin", state: "Edo", zone: "South-South", type: "FGGC" },
  { id: "fstc_uromi", name: "Federal Science and Technical College, Uromi", shortName: "FSTC Uromi", state: "Edo", zone: "South-South", type: "FSTC" },
  { id: "fgc_portharcourt", name: "Federal Government College, Port Harcourt", shortName: "FGC Port Harcourt", state: "Rivers", zone: "South-South", type: "FGC" },
  { id: "fggc_abuloma", name: "Federal Government Girls' College, Abuloma", shortName: "FGGC Abuloma", state: "Rivers", zone: "South-South", type: "FGGC" },
  { id: "fstc_ahoada", name: "Federal Science and Technical College, Ahoada", shortName: "FSTC Ahoada", state: "Rivers", zone: "South-South", type: "FSTC" },

  // ──────────────────────────────────────────────────────────────────────────
  // SOUTH-WEST (19 Schools across Ekiti, Lagos, Ogun, Ondo, Osun, Oyo)
  // ──────────────────────────────────────────────────────────────────────────
  { id: "fgc_ikoleekiti", name: "Federal Government College, Ikole-Ekiti", shortName: "FGC Ikole-Ekiti", state: "Ekiti", zone: "South-West", type: "FGC" },
  { id: "fggc_efonalaaye", name: "Federal Government Girls' College, Efon-Alaaye", shortName: "FGGC Efon-Alaaye", state: "Ekiti", zone: "South-West", type: "FGGC" },
  { id: "fstc_usiekiti", name: "Federal Science and Technical College, Usi-Ekiti", shortName: "FSTC Usi-Ekiti", state: "Ekiti", zone: "South-West", type: "FSTC" },
  { id: "kings_college", name: "King's College, Lagos", shortName: "King's College Lagos", state: "Lagos", zone: "South-West", type: "Special" },
  { id: "queens_college", name: "Queen's College, Lagos", shortName: "Queen's College Lagos", state: "Lagos", zone: "South-West", type: "Special" },
  { id: "fgc_ijanikin", name: "Federal Government College, Lagos (Ijanikin)", shortName: "FGC Lagos (Ijanikin)", state: "Lagos", zone: "South-West", type: "FGC" },
  { id: "fstc_yaba", name: "Federal Science and Technical College, Yaba", shortName: "FSTC Yaba", state: "Lagos", zone: "South-West", type: "FSTC" },
  { id: "fgc_odogbolu", name: "Federal Government College, Odogbolu", shortName: "FGC Odogbolu", state: "Ogun", zone: "South-West", type: "FGC" },
  { id: "fggc_sagamu", name: "Federal Government Girls' College, Sagamu", shortName: "FGGC Sagamu", state: "Ogun", zone: "South-West", type: "FGGC" },
  { id: "fstc_ijebuimushin", name: "Federal Science and Technical College, Ijebu-Imushin", shortName: "FSTC Ijebu-Imushin", state: "Ogun", zone: "South-West", type: "FSTC" },
  { id: "fgc_idoani", name: "Federal Government College, Idoani", shortName: "FGC Idoani", state: "Ondo", zone: "South-West", type: "FGC" },
  { id: "fggc_akure", name: "Federal Government Girls' College, Akure", shortName: "FGGC Akure", state: "Ondo", zone: "South-West", type: "FGGC" },
  { id: "fstc_ikareakoko", name: "Federal Science and Technical College, Ikare-Akoko", shortName: "FSTC Ikare-Akoko", state: "Ondo", zone: "South-West", type: "FSTC" },
  { id: "fgc_ikirun", name: "Federal Government College, Ikirun", shortName: "FGC Ikirun", state: "Osun", zone: "South-West", type: "FGC" },
  { id: "fggc_ipetumodu", name: "Federal Government Girls' College, Ipetumodu", shortName: "FGGC Ipetumodu", state: "Osun", zone: "South-West", type: "FGGC" },
  { id: "fstc_ilesa", name: "Federal Science and Technical College, Ilesa", shortName: "FSTC Ilesa", state: "Osun", zone: "South-West", type: "FSTC" },
  { id: "fgc_ogbomoso", name: "Federal Government College, Ogbomoso", shortName: "FGC Ogbomoso", state: "Oyo", zone: "South-West", type: "FGC" },
  { id: "fggc_oyo", name: "Federal Government Girls' College, Oyo", shortName: "FGGC Oyo", state: "Oyo", zone: "South-West", type: "FGGC" },
  { id: "fstc_igangan", name: "Federal Science and Technical College, Igangan", shortName: "FSTC Igangan", state: "Oyo", zone: "South-West", type: "FSTC" },
];

/**
 * Exact list of 115 short names sorted alphabetically for clean dropdown selection.
 */
export const UNITY_SCHOOLS_LIST: string[] = ALL_115_UNITY_SCHOOLS.map((s) => s.shortName).sort((a, b) => a.localeCompare(b));

/**
 * Dropdown options with optional custom entry at bottom
 */
export const UNITY_SCHOOLS_OPTIONS: string[] = [
  ...UNITY_SCHOOLS_LIST,
  "Other / External High School",
];

export const UNITY_SCHOOLS_COUNT = ALL_115_UNITY_SCHOOLS.length;
