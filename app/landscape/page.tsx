"use client";

// =================================================================
// app/landscape/page.tsx
//
// Carrierwave — RO-Centric 2D Research Landscape
// Each dot is a Research Object positioned by semantic similarity.
// No predefined axes — clusters emerge from the data.
// =================================================================

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { Delaunay } from "d3-delaunay";
import type { ROType, ConfidenceLevel } from "@/types/ro";
import type { RODataPoint, ROCoordinate, LandscapeClusterLabel, ROLandscapeResponse } from "@/types/landscape";

// ── Type colors (mirrored from explore page) ─────────────────

const TYPE_COLORS: Record<ROType, string> = {
  new_finding:              "#4f8cff",
  negative_result:          "#ff9f43",
  replication_successful:   "#2eddaa",
  replication_unsuccessful: "#ff6b6b",
  methodology:              "#a29bfe",
  materials_reagents:       "#74b9ff",
  data_update:              "#81ecec",
};

const TYPE_LABELS: Record<ROType, string> = {
  new_finding:              "New Finding",
  negative_result:          "Negative Result",
  replication_successful:   "Replication +",
  replication_unsuccessful: "Replication -",
  methodology:              "Methodology",
  materials_reagents:       "Reagents",
  data_update:              "Data Update",
};

// ── Confidence → border thickness ────────────────────────────

const CONF_STROKE: Record<ConfidenceLevel, number> = { 1: 0.3, 2: 0.3, 3: 0.3 };

// ── Synthetic test dataset (30 ROs) ──────────────────────────

const SYNTHETIC_ROS: RODataPoint[] = [
  // Neuroscience cluster (6)
  { id: "syn-01", title: "Tau phosphorylation drives synaptic loss in APP/PS1 mice", claim: "Hyperphosphorylated tau at Thr231 precedes amyloid plaque formation", abstract: "In a 12-month longitudinal study of APP/PS1 transgenic mice we show that tau hyperphosphorylation at Thr231 appears at 3 months, preceding detectable amyloid plaques by 2 months.", roType: "new_finding", species: "Mouse", confidence: 3, diseaseAreaTags: ["Alzheimer's"], minted: true },
  { id: "syn-02", title: "Circadian rhythm disruption in zebrafish per2 mutants", claim: "per2 knockout zebrafish show 26-hour free-running period", abstract: "CRISPR-generated per2 knockout zebrafish display elongated circadian period of 26.1h under constant darkness, with disrupted locomotor activity patterns.", roType: "new_finding", species: "Zebrafish", confidence: 2, diseaseAreaTags: [], minted: false },
  { id: "syn-03", title: "Replication of PFF-induced alpha-synuclein spreading in mice", claim: "Preformed fibril injection replicates Luk et al. 2012 Lewy pathology spreading", abstract: "We independently replicated the preformed fibril alpha-synuclein injection model, confirming cell-to-cell spreading of Lewy-like pathology from striatum to cortex within 6 months.", roType: "replication_successful", species: "Mouse", confidence: 3, diseaseAreaTags: ["Parkinson's"], minted: true },
  { id: "syn-04", title: "Gut microbiome-serotonin axis in depression model", claim: "Fecal transplant from depressed patients induces anhedonia in germ-free mice", abstract: "Germ-free mice colonized with fecal microbiota from MDD patients show reduced sucrose preference and increased immobility in forced swim test compared to healthy donor controls.", roType: "new_finding", species: "Mouse", confidence: 2, diseaseAreaTags: ["Depression"], minted: false },
  { id: "syn-05", title: "Failed replication: BDNF Val66Met anxiety phenotype in C57BL/6", claim: "BDNF Val66Met knock-in mice do not show elevated anxiety on EPM", abstract: "We attempted to replicate the reported anxiety phenotype in BDNF Val66Met knock-in mice but found no significant difference in elevated plus maze performance across 4 independent cohorts.", roType: "replication_unsuccessful", species: "Mouse", confidence: 3, diseaseAreaTags: [], minted: false },
  { id: "syn-06", title: "Optogenetic silencing of VTA dopamine neurons during reward learning", claim: "Transient VTA DA inhibition impairs but does not abolish reward prediction error signaling", abstract: "Using Halo-mediated optogenetic inhibition of VTA dopaminergic neurons during a Pavlovian conditioning task, we show attenuated but not abolished reward prediction error signals.", roType: "new_finding", species: "Mouse", confidence: 2, diseaseAreaTags: [], minted: false },

  // Oncology cluster (5)
  { id: "syn-07", title: "BRCA1 ctDNA methylation as early breast cancer biomarker", claim: "Circulating BRCA1 promoter methylation detects stage I breast cancer with 82% sensitivity", abstract: "In a prospective cohort of 1200 women, circulating tumor DNA methylation of BRCA1 promoter detected stage I breast cancer with 82% sensitivity and 94% specificity.", roType: "new_finding", species: "Human", confidence: 3, diseaseAreaTags: ["Breast Cancer"], minted: true },
  { id: "syn-08", title: "HER2-low trastuzumab-deruxtecan response not replicated", claim: "T-DXd fails to improve PFS in HER2-low gastric cancer cohort", abstract: "In a single-arm phase II trial of 45 patients with HER2-low gastric adenocarcinoma, trastuzumab-deruxtecan did not meet its primary endpoint of improved progression-free survival.", roType: "replication_unsuccessful", species: "Human", confidence: 2, diseaseAreaTags: ["Gastric Cancer"], minted: false },
  { id: "syn-09", title: "Single-cell atlas of pancreatic ductal adenocarcinoma stroma", claim: "Three distinct CAF subtypes identified in PDAC with opposing immunomodulatory roles", abstract: "scRNA-seq of 85,000 cells from 12 PDAC tumors reveals three cancer-associated fibroblast subtypes: inflammatory (iCAF), myofibroblastic (myCAF), and antigen-presenting (apCAF).", roType: "new_finding", species: "Human", confidence: 3, diseaseAreaTags: ["Pancreatic Cancer"], minted: true },
  { id: "syn-10", title: "Spatial transcriptomics protocol for FFPE tumor sections", claim: "Modified Visium protocol recovers 40% more transcripts from archival FFPE samples", abstract: "We optimized the 10x Visium spatial transcriptomics protocol for formalin-fixed paraffin-embedded tumor sections, achieving 40% improvement in unique transcript capture.", roType: "methodology", species: "N/A", confidence: 2, diseaseAreaTags: [], minted: false },
  { id: "syn-11", title: "Negative result: PD-L1 blockade in MSS colorectal organoids", claim: "Anti-PD-L1 does not restore T-cell cytotoxicity in microsatellite-stable CRC organoids", abstract: "Co-culture of patient-derived MSS colorectal cancer organoids with autologous TILs showed no improvement in tumor cell killing upon PD-L1 blockade.", roType: "negative_result", species: "Human", confidence: 2, diseaseAreaTags: ["Colorectal Cancer"], minted: false },

  // Genomics/CRISPR cluster (4)
  { id: "syn-12", title: "Prime editing efficiency in human HSCs reaches 45%", claim: "PE3max achieves 45% precise editing in CD34+ HSCs without DSBs", abstract: "Using optimized PE3max prime editing system in mobilized peripheral blood CD34+ hematopoietic stem cells, we achieved 45% precise editing efficiency for sickle cell mutation correction.", roType: "new_finding", species: "Human", confidence: 3, diseaseAreaTags: ["Sickle Cell Disease"], minted: true },
  { id: "syn-13", title: "Genome-wide CRISPRi screen for essential lncRNAs in K562", claim: "147 lncRNAs identified as essential for K562 cell viability", abstract: "A genome-wide CRISPRi screen targeting 16,401 lncRNA TSSs in K562 cells identified 147 lncRNAs whose repression significantly reduced cell fitness.", roType: "new_finding", species: "Human", confidence: 2, diseaseAreaTags: [], minted: false },
  { id: "syn-14", title: "BCL11A enhancer base editing for fetal hemoglobin reactivation", claim: "ABE8e disruption of BCL11A erythroid enhancer reactivates HbF to 35%", abstract: "Adenine base editing at the BCL11A erythroid-specific enhancer in patient CD34+ cells achieved 35% fetal hemoglobin reactivation without detectable off-target editing.", roType: "new_finding", species: "Human", confidence: 3, diseaseAreaTags: ["Sickle Cell Disease", "Thalassemia"], minted: false },
  { id: "syn-15", title: "Human pangenome reference v2.0 structural variant catalog", claim: "94 new assemblies add 12,000 previously unresolved SVs to pangenome", abstract: "Version 2.0 of the human pangenome reference incorporates 94 new haplotype-resolved assemblies, cataloging 12,000 structural variants absent from GRCh38.", roType: "data_update", species: "Human", confidence: 3, diseaseAreaTags: [], minted: false },

  // Immunology/Infectious cluster (4)
  { id: "syn-16", title: "Long COVID monocyte transcriptome reveals persistent activation", claim: "CD14+ monocytes from Long COVID patients show NF-kB upregulation at 12 months", abstract: "Bulk RNA-seq of sorted CD14+ monocytes from 30 Long COVID patients at 12 months post-infection shows persistent NF-kB pathway activation compared to recovered controls.", roType: "new_finding", species: "Human", confidence: 2, diseaseAreaTags: ["COVID-19", "Long COVID"], minted: false },
  { id: "syn-17", title: "M. tuberculosis persister formation in alveolar macrophages", claim: "Mtb switches to lipid catabolism within 48h of macrophage infection", abstract: "Single-cell metabolomics reveals M. tuberculosis shifts to lipid-based catabolism within 48 hours of alveolar macrophage infection, enabling antibiotic-tolerant persister formation.", roType: "new_finding", species: "Human", confidence: 2, diseaseAreaTags: ["Tuberculosis"], minted: false },
  { id: "syn-18", title: "Replication: RA-ILD prevalence in anti-CCP+ cohort", claim: "Independent cohort confirms 8-10% ILD prevalence in high-titer anti-CCP+ RA", abstract: "In an independent cohort of 800 anti-CCP+ rheumatoid arthritis patients, we confirmed 9.2% prevalence of interstitial lung disease, consistent with prior reports of 8-10%.", roType: "replication_successful", species: "Human", confidence: 2, diseaseAreaTags: ["Rheumatoid Arthritis"], minted: false },
  { id: "syn-19", title: "Negative result: HIV bnAb VRC01 does not prevent acquisition", claim: "VRC01 infusion does not reduce HIV-1 acquisition in high-risk cohort", abstract: "In the HVTN 704 trial, bimonthly VRC01 broadly neutralizing antibody infusions did not significantly reduce HIV-1 acquisition compared to placebo in the overall analysis.", roType: "negative_result", species: "Human", confidence: 3, diseaseAreaTags: ["HIV"], minted: true },

  // Metabolic/Cardiovascular cluster (4)
  { id: "syn-20", title: "Semaglutide reverses NASH fibrosis in phase IIb trial", claim: "24 weeks of semaglutide 2.4mg reduces liver fibrosis by 1 stage in 43% of patients", abstract: "In a randomized phase IIb trial of 320 biopsy-confirmed NASH patients, semaglutide 2.4mg achieved fibrosis improvement of at least 1 stage in 43% vs 13% placebo.", roType: "new_finding", species: "Human", confidence: 3, diseaseAreaTags: ["NASH", "NAFLD"], minted: true },
  { id: "syn-21", title: "Brown adipose tissue activation via beta-3 agonist in obese mice", claim: "CL-316,243 increases BAT thermogenesis and reduces body weight 15% in DIO mice", abstract: "Chronic beta-3 adrenergic agonist CL-316,243 treatment of diet-induced obese mice increased BAT UCP1 expression 3-fold and reduced body weight by 15% over 8 weeks.", roType: "new_finding", species: "Mouse", confidence: 2, diseaseAreaTags: ["Obesity"], minted: false },
  { id: "syn-22", title: "Titin truncating variants in dilated cardiomyopathy families", claim: "TTNtv carriers show 60% penetrance for DCM by age 50 in familial cohort", abstract: "In a familial dilated cardiomyopathy cohort of 200 TTNtv carriers followed longitudinally, we observe 60% penetrance by age 50 with earlier onset in males.", roType: "new_finding", species: "Human", confidence: 3, diseaseAreaTags: ["Heart Failure", "Cardiomyopathy"], minted: false },
  { id: "syn-23", title: "PCSK9 inhibition and coronary plaque regression by IVUS", claim: "Evolocumab reduces coronary plaque volume by 1.2% over 18 months", abstract: "Serial intravascular ultrasound in 150 statin-treated patients randomized to evolocumab showed 1.2% coronary plaque volume regression vs 0.1% progression on placebo.", roType: "replication_successful", species: "Human", confidence: 3, diseaseAreaTags: ["Atherosclerosis"], minted: false },

  // Ecology/Model Organisms cluster (4)
  { id: "syn-24", title: "Microplastic accumulation in zebrafish gut epithelium", claim: "Chronic microplastic exposure causes gut barrier disruption and inflammation in zebrafish", abstract: "Adult zebrafish exposed to 5um polystyrene microplastics for 30 days develop gut epithelial barrier disruption, elevated TNF-alpha, and reduced nutrient absorption.", roType: "new_finding", species: "Zebrafish", confidence: 2, diseaseAreaTags: [], minted: false },
  { id: "syn-25", title: "Drosophila insulin receptor substrate chico regulates lifespan", claim: "chico heterozygotes live 36% longer with preserved fecundity", abstract: "Drosophila melanogaster heterozygous for the insulin receptor substrate chico show 36% median lifespan extension without significant reduction in lifetime fecundity.", roType: "replication_successful", species: "Drosophila", confidence: 3, diseaseAreaTags: [], minted: false },
  { id: "syn-26", title: "C. elegans dietary restriction via bacterial dilution protocol", claim: "Standardized BD protocol extends C. elegans lifespan 20-30% across 5 labs", abstract: "A standardized bacterial dilution dietary restriction protocol was validated across 5 independent labs, consistently extending C. elegans mean lifespan by 20-30%.", roType: "methodology", species: "C. elegans", confidence: 3, diseaseAreaTags: [], minted: false },
  { id: "syn-27", title: "Automated lifespan scoring for C. elegans using deep learning", claim: "DeepWorm scores survival curves with 97% concordance to manual counting", abstract: "We present DeepWorm, a convolutional neural network that automates C. elegans lifespan scoring from plate images with 97% concordance with expert manual scoring.", roType: "methodology", species: "C. elegans", confidence: 2, diseaseAreaTags: [], minted: false },

  // Outliers (3)
  { id: "syn-28", title: "CFTR modulator response in pediatric CF patients under 2 years", claim: "Elexacaftor-tezacaftor-ivacaftor is safe and effective in CF patients aged 6-24 months", abstract: "In a phase III trial of 60 CF patients aged 6-24 months, ETI triple therapy improved sweat chloride by 54 mmol/L with acceptable safety profile.", roType: "new_finding", species: "Human", confidence: 3, diseaseAreaTags: ["Cystic Fibrosis"], minted: true },
  { id: "syn-29", title: "LLM-predicted protein binding affinities vs experimental Kd", claim: "GPT-4 predicts protein-ligand Kd within 1 log unit for 68% of test pairs", abstract: "We benchmarked GPT-4 zero-shot prediction of protein-ligand binding affinity against experimentally measured Kd values for 500 pairs, finding 68% within 1 log unit.", roType: "methodology", species: "N/A", confidence: 1, diseaseAreaTags: [], minted: false },
  { id: "syn-30", title: "UK Biobank whole-genome sequencing data release: 200K update", claim: "200,000 additional WGS samples now available with linked phenotype data", abstract: "The UK Biobank releases 200,000 additional whole-genome sequences at 30x coverage, with linked primary care, hospital episode, and self-reported phenotype data.", roType: "data_update", species: "Human", confidence: 3, diseaseAreaTags: [], minted: false },
];

// ── Styles ────────────────────────────────────────────────────

const css = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=DM+Sans:wght@300;400;500;600&family=Space+Grotesk:wght@300;700&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --bg:      #0b0e14;
    --surface: #121620;
    --surface2:#161b26;
    --border:  #1f2535;
    --muted:   #2e3650;
    --subtle:  #4a5580;
    --text:    #c8d0e8;
    --bright:  #e8edf8;
    --accent:  #4f8cff;
    --accent2: #2eddaa;
    --warn:    #ff9f43;
    --danger:  #ff6b6b;
    --mono:    'DM Mono', monospace;
    --sans:    'DM Sans', system-ui, sans-serif;
    --r:       10px;
    --t:       160ms ease;
  }

  body {
    background: var(--bg);
    color: var(--text);
    font-family: var(--sans);
    font-size: 14px;
    line-height: 1.6;
    min-height: 100vh;
  }

  body::before {
    content: '';
    position: fixed; inset: 0;
    background-image:
      linear-gradient(rgba(79,140,255,0.03) 1px, transparent 1px),
      linear-gradient(90deg, rgba(79,140,255,0.03) 1px, transparent 1px);
    background-size: 48px 48px;
    pointer-events: none;
    z-index: 0;
  }

  .ls-page {
    max-width: 960px;
    margin: 0 auto;
    padding: 36px 24px 80px;
    position: relative;
    z-index: 1;
  }

  /* Topbar */
  .ls-topbar {
    display: flex; align-items: center; justify-content: space-between;
    margin-bottom: 32px; padding-bottom: 20px;
    border-bottom: 1px solid var(--border);
  }
  .ls-wordmark {
    font-family: Helvetica, Arial, sans-serif;
    font-size: 28px; font-weight: 700;
    color: var(--bright); text-decoration: none; letter-spacing: -0.5px;
  }
  .ls-wordmark em { color: var(--accent); font-style: italic; }
  .ls-back {
    font-family: var(--mono); font-size: 12px; color: var(--subtle);
    text-decoration: none; transition: color var(--t);
  }
  .ls-back:hover { color: var(--accent); }

  /* Headline */
  .ls-headline {
    font-family: 'Space Grotesk', system-ui, sans-serif;
    font-weight: 700; font-size: 28px; color: var(--bright);
    line-height: 1.25; margin-bottom: 8px;
  }
  .ls-sub {
    font-size: 14px; color: var(--subtle); margin-bottom: 28px;
    line-height: 1.6;
  }

  /* Mode tabs */
  .ls-tabs {
    display: flex; gap: 2px; margin-bottom: 20px;
    background: var(--surface); border: 1px solid var(--border);
    border-radius: var(--r); overflow: hidden;
  }
  .ls-tab {
    flex: 1; padding: 12px 16px; text-align: center;
    font-family: var(--mono); font-size: 12px; color: var(--subtle);
    cursor: pointer; transition: all var(--t);
    border: none; background: transparent;
  }
  .ls-tab:hover { color: var(--text); background: var(--surface2); }
  .ls-tab.active {
    color: var(--accent); background: rgba(79,140,255,0.08);
    box-shadow: inset 0 -2px 0 var(--accent);
  }
  .ls-tab.disabled {
    opacity: 0.4; cursor: not-allowed;
  }
  .ls-tab-label { display: block; font-weight: 500; margin-bottom: 2px; }
  .ls-tab-desc { font-size: 10px; color: var(--muted); }
  .ls-tab.active .ls-tab-desc { color: var(--subtle); }

  /* SVG container */
  .ls-svg-wrap {
    background: var(--surface); border: 1px solid var(--border);
    border-radius: var(--r); padding: 20px;
    position: relative;
  }

  /* Tooltip */
  .ls-tooltip {
    position: absolute; pointer-events: none;
    background: #0d1018; border: 1px solid var(--border);
    border-radius: 6px; padding: 10px 14px;
    font-family: var(--mono); font-size: 11px;
    color: var(--bright); white-space: nowrap;
    box-shadow: 0 4px 16px rgba(0,0,0,0.4);
    z-index: 10; transform: translate(-50%, -100%);
    margin-top: -12px;
    max-width: 320px;
  }
  .ls-tooltip-title {
    font-weight: 500; margin-bottom: 4px;
    white-space: normal; line-height: 1.4;
  }
  .ls-tooltip-row {
    display: flex; align-items: center; gap: 8px;
    margin-top: 3px; font-size: 10px; color: var(--text);
  }
  .ls-tooltip-badge {
    display: inline-block; padding: 1px 6px;
    border-radius: 3px; font-size: 9px; font-weight: 500;
  }
  .ls-tooltip-dots {
    display: flex; gap: 3px;
  }
  .ls-tooltip-dot {
    width: 5px; height: 5px; border-radius: 50%;
  }

  /* Legends */
  .ls-legends {
    display: flex; gap: 16px; margin-top: 16px; flex-wrap: wrap;
  }
  .ls-legend {
    display: flex; align-items: center; gap: 12px;
    padding: 12px 16px; flex: 1; min-width: 280px;
    background: var(--surface); border: 1px solid var(--border);
    border-radius: var(--r);
  }
  .ls-legend-title {
    font-family: var(--mono); font-size: 10px;
    letter-spacing: 0.08em; text-transform: uppercase; color: var(--subtle);
    flex-shrink: 0;
  }
  .ls-legend-items {
    display: flex; flex-wrap: wrap; gap: 10px;
    align-items: center;
  }
  .ls-legend-item {
    display: flex; align-items: center; gap: 5px;
    font-family: var(--mono); font-size: 10px; color: var(--text);
  }
  .ls-legend-swatch {
    width: 12px; height: 12px; border-radius: 2px; flex-shrink: 0;
  }
  .ls-legend-conf {
    width: 12px; height: 12px; border-radius: 2px;
    background: transparent; flex-shrink: 0;
  }
  .ls-legend-minted {
    width: 12px; height: 12px; border-radius: 2px;
    border: 1px solid var(--bright); flex-shrink: 0;
  }

  /* Voronoi cell transitions */
  .ls-cell {
    transition: fill-opacity 150ms ease;
  }

  /* Stats row */
  .ls-stats {
    display: flex; gap: 24px; margin-top: 16px; flex-wrap: wrap;
    font-family: var(--mono); font-size: 11px; color: var(--subtle);
  }
  .ls-stats span { color: var(--accent); }

  /* Loading */
  .ls-loading {
    display: flex; align-items: center; justify-content: center;
    height: 400px; font-family: var(--mono); font-size: 13px; color: var(--subtle);
  }
  @keyframes ls-pulse { 0%,100%{opacity:.4} 50%{opacity:1} }
  .ls-loading { animation: ls-pulse 1.5s ease infinite; }

  /* Fade in */
  @keyframes ls-fadeIn { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:translateY(0); } }
  .ls-fade { animation: ls-fadeIn 400ms ease both; }

  @media (max-width: 600px) {
    .ls-headline { font-size: 22px; }
    .ls-tabs { flex-direction: column; }
    .ls-legends { flex-direction: column; }
  }
`;

// ── SVG constants ─────────────────────────────────────────────

const SVG_W = 900;
const SVG_H = 650;
const PAD = 40;

// ── Component ─────────────────────────────────────────────────

type Mode = "synthetic" | "live";

interface TooltipData {
  title: string;
  roType: ROType;
  species: string;
  confidence: number;
  minted: boolean;
  x: number;
  y: number;
}

export default function LandscapePage() {
  const [mode, setMode] = useState<Mode>("synthetic");
  const [data, setData] = useState<ROLandscapeResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [liveDisabled, setLiveDisabled] = useState(true);
  const [liveRoCount, setLiveRoCount] = useState(0);
  const svgWrapRef = useRef<HTMLDivElement>(null);
  const fetchedRef = useRef<Record<string, boolean>>({});

  // ── Voronoi tessellation (computed client-side) ──────────────
  const voronoiData = useMemo(() => {
    if (!data || data.coordinates.length < 3) return null;
    const pts = data.coordinates.map(c => [
      PAD + c.x * (SVG_W - 2 * PAD),
      PAD + c.y * (SVG_H - 2 * PAD),
    ] as [number, number]);
    // jitter near-duplicate points to avoid degenerate cells
    const seen = new Set<string>();
    for (let i = 0; i < pts.length; i++) {
      const key = `${Math.round(pts[i][0])},${Math.round(pts[i][1])}`;
      if (seen.has(key)) {
        pts[i][0] += (Math.random() - 0.5) * 4;
        pts[i][1] += (Math.random() - 0.5) * 4;
      }
      seen.add(key);
    }
    const delaunay = Delaunay.from(pts);
    const voronoi = delaunay.voronoi([PAD, PAD, SVG_W - PAD, SVG_H - PAD]);
    return { voronoi, pts };
  }, [data]);

  // Check how many live ROs exist
  useEffect(() => {
    fetch("/api/ro/list?limit=1")
      .then(r => r.json())
      .then(d => {
        const total = d.total ?? d.ros?.length ?? 0;
        setLiveRoCount(total);
        setLiveDisabled(total < 5);
      })
      .catch(() => {});
  }, []);

  const fetchCoordinates = useCallback(async (m: Mode) => {
    setError(null);
    setTooltip(null);

    const source = m === "synthetic" ? SYNTHETIC_ROS : null;

    if (m === "live") {
      // Fetch ROs from KV
      setLoading(true);
      try {
        const listRes = await fetch("/api/ro/list?limit=200");
        if (!listRes.ok) throw new Error("Failed to fetch ROs");
        const listData = await listRes.json();
        const ros = (listData.ros ?? []) as Array<{
          id: string; title: string; claim: string; abstract: string;
          roType: string; species: string; confidence: number;
          diseaseAreaTags: string[]; minted: boolean;
        }>;
        if (ros.length < 5) {
          setError("Need at least 5 ROs for the landscape");
          setLoading(false);
          return;
        }
        const dataPoints: RODataPoint[] = ros.map(r => ({
          id: r.id,
          title: r.title,
          claim: r.claim,
          abstract: r.abstract ?? "",
          roType: r.roType,
          species: r.species,
          confidence: r.confidence,
          diseaseAreaTags: r.diseaseAreaTags ?? [],
          minted: r.minted ?? false,
        }));
        await callAPI(dataPoints);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load live ROs");
        setLoading(false);
      }
      return;
    }

    if (!source) return;

    // Synthetic: check if already fetched
    const cacheKey = "synthetic";
    if (fetchedRef.current[cacheKey] && data) return;

    setLoading(true);
    await callAPI(source);
    fetchedRef.current[cacheKey] = true;
  }, [data]);

  const callAPI = async (ros: RODataPoint[]) => {
    try {
      const res = await fetch("/api/landscape/ro-coordinates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ros }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP ${res.status}`);
      }

      const result = (await res.json()) as ROLandscapeResponse;
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate coordinates");
    } finally {
      setLoading(false);
    }
  };

  // Load synthetic on mount
  useEffect(() => {
    fetchCoordinates("synthetic");
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleModeChange = (m: Mode) => {
    if (m === "live" && liveDisabled) return;
    setMode(m);
    setData(null);
    fetchCoordinates(m);
  };

  const handleMouseMove = (e: React.MouseEvent<SVGElement>, coord: ROCoordinate) => {
    if (!svgWrapRef.current) return;
    const rect = svgWrapRef.current.getBoundingClientRect();
    setTooltip({
      title: coord.title,
      roType: coord.roType as ROType,
      species: coord.species,
      confidence: coord.confidence,
      minted: coord.minted,
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  };

  // Compute stats
  const roCount = data?.coordinates.length ?? 0;
  const clusterCount = data?.clusters.length ?? 0;
  const speciesSet = new Set(data?.coordinates.map(c => c.species) ?? []);
  const typeBreakdown: Record<string, number> = {};
  for (const c of data?.coordinates ?? []) {
    typeBreakdown[c.roType] = (typeBreakdown[c.roType] ?? 0) + 1;
  }

  return (
    <>
      <style>{css}</style>
      <div className="ls-page ls-fade">
        {/* Topbar */}
        <div className="ls-topbar">
          <a href="/" className="ls-wordmark">carrier<em>wave</em></a>
          <a href="/explore" className="ls-back">&larr; Back to Explorer</a>
        </div>

        {/* Headline */}
        <h1 className="ls-headline">Research Landscape</h1>
        <p className="ls-sub">
          Each cell is a Research Object, positioned by semantic similarity.
          Boundaries mark where studies meet.
        </p>

        {/* Mode tabs */}
        <div className="ls-tabs">
          <button
            className={`ls-tab${mode === "synthetic" ? " active" : ""}`}
            onClick={() => handleModeChange("synthetic")}
          >
            <span className="ls-tab-label">Synthetic Demo</span>
            <span className="ls-tab-desc">30 example ROs across 6 research areas</span>
          </button>
          <button
            className={`ls-tab${mode === "live" ? " active" : ""}${liveDisabled ? " disabled" : ""}`}
            onClick={() => handleModeChange("live")}
          >
            <span className="ls-tab-label">Live ROs</span>
            <span className="ls-tab-desc">
              {liveDisabled
                ? `(need 5+ ROs, currently ${liveRoCount})`
                : `${liveRoCount} ROs from Carrierwave`}
            </span>
          </button>
        </div>

        {/* SVG container */}
        <div className="ls-svg-wrap" ref={svgWrapRef}>
          {loading ? (
            <div className="ls-loading">Mapping research objects with Claude...</div>
          ) : error ? (
            <div className="ls-loading" style={{ color: "var(--danger)" }}>{error}</div>
          ) : data ? (
            <>
              <svg
                viewBox={`0 0 ${SVG_W} ${SVG_H}`}
                width="100%"
                style={{ display: "block" }}
                onMouseLeave={() => { setTooltip(null); setHoveredIdx(null); }}
              >
                {/* 1. Border rect */}
                <rect x={PAD} y={PAD} width={SVG_W - 2 * PAD} height={SVG_H - 2 * PAD}
                  fill="none" stroke="#1a2035" strokeWidth={1} rx={4} />

                {voronoiData && (
                  <>
                    {/* 2. Base edge grid — all Voronoi edges as one path */}
                    <path
                      d={voronoiData.voronoi.render()}
                      fill="none"
                      stroke="#1a2035"
                      strokeWidth={0.3}
                    />

                    {/* 3. Voronoi cell paths */}
                    {data.coordinates.map((coord, i) => {
                      const color = TYPE_COLORS[coord.roType as ROType] ?? "#4f8cff";
                      const sw = CONF_STROKE[(coord.confidence as ConfidenceLevel)] ?? 0.5;
                      const cellPath = voronoiData.voronoi.renderCell(i);
                      const fillOpacity = hoveredIdx === null
                        ? 0.15
                        : hoveredIdx === i ? 0.35 : 0.08;

                      return (
                        <path
                          key={coord.id}
                          className="ls-cell"
                          d={cellPath}
                          fill={color}
                          fillOpacity={fillOpacity}
                          stroke={coord.minted ? "#e8edf8" : color}
                          strokeWidth={sw}
                          onMouseMove={(e) => { setHoveredIdx(i); handleMouseMove(e, coord); }}
                          onMouseLeave={() => { setHoveredIdx(null); setTooltip(null); }}
                          onClick={() => {
                            if (mode === "live" && !coord.id.startsWith("syn-")) {
                              window.location.href = `/ro/${coord.id}`;
                            }
                          }}
                          style={{ cursor: mode === "live" ? "pointer" : "default" }}
                        />
                      );
                    })}

                    {/* 4. Seed dots — small circles at each RO's position */}
                    {data.coordinates.map((coord, i) => {
                      const color = TYPE_COLORS[coord.roType as ROType] ?? "#4f8cff";
                      return (
                        <circle
                          key={`dot-${coord.id}`}
                          cx={voronoiData.pts[i][0]}
                          cy={voronoiData.pts[i][1]}
                          r={3}
                          fill={color}
                          opacity={0.7}
                          pointerEvents="none"
                        />
                      );
                    })}
                  </>
                )}

                {/* 5. Cluster labels */}
                {data.clusters.map(cluster => {
                  const cx = PAD + cluster.cx * (SVG_W - 2 * PAD);
                  const cy = PAD + cluster.cy * (SVG_H - 2 * PAD);
                  return (
                    <text
                      key={cluster.label}
                      x={cx} y={cy}
                      textAnchor="middle"
                      fill="#4a5580"
                      fontSize={11}
                      fontFamily="'DM Mono', monospace"
                      fontWeight={500}
                      letterSpacing="0.08em"
                      opacity={0.4}
                      paintOrder="stroke"
                      stroke="#0b0e14"
                      strokeWidth={3}
                      strokeLinejoin="round"
                      style={{ textTransform: "uppercase" } as React.CSSProperties}
                    >
                      {cluster.label.toUpperCase()}
                    </text>
                  );
                })}
              </svg>

              {/* Tooltip */}
              {tooltip && (
                <div className="ls-tooltip"
                  style={{ left: tooltip.x, top: tooltip.y }}
                >
                  <div className="ls-tooltip-title">
                    {tooltip.title.length > 60
                      ? tooltip.title.slice(0, 58) + "..."
                      : tooltip.title}
                  </div>
                  <div className="ls-tooltip-row">
                    <span className="ls-tooltip-badge"
                      style={{
                        background: `${TYPE_COLORS[tooltip.roType]}20`,
                        color: TYPE_COLORS[tooltip.roType],
                      }}
                    >
                      {TYPE_LABELS[tooltip.roType]}
                    </span>
                    <span style={{ color: "var(--subtle)" }}>{tooltip.species}</span>
                  </div>
                  <div className="ls-tooltip-row">
                    <span style={{ color: "var(--subtle)", fontSize: 9 }}>Confidence</span>
                    <span className="ls-tooltip-dots">
                      {[1, 2, 3].map(i => (
                        <span key={i} className="ls-tooltip-dot"
                          style={{
                            background: i <= tooltip.confidence ? "#4f8cff" : "#2e3650",
                          }}
                        />
                      ))}
                    </span>
                    {tooltip.minted && (
                      <span className="ls-tooltip-badge"
                        style={{ background: "#2eddaa20", color: "#2eddaa" }}
                      >
                        Minted
                      </span>
                    )}
                  </div>
                </div>
              )}
            </>
          ) : null}
        </div>

        {/* Legends */}
        <div className="ls-legends">
          {/* Type color legend */}
          <div className="ls-legend" style={{ flex: 2 }}>
            <span className="ls-legend-title">Type</span>
            <div className="ls-legend-items">
              {(Object.entries(TYPE_LABELS) as [ROType, string][]).map(([type, label]) => (
                <span key={type} className="ls-legend-item">
                  <span className="ls-legend-swatch"
                    style={{
                      background: `${TYPE_COLORS[type]}26`,
                      border: `1px solid ${TYPE_COLORS[type]}`,
                    }}
                  />
                  {label}
                </span>
              ))}
            </div>
          </div>

          {/* Border thickness / confidence legend */}
          <div className="ls-legend">
            <span className="ls-legend-title">Confidence</span>
            <div className="ls-legend-items">
              {([1, 2, 3] as ConfidenceLevel[]).map(c => (
                <span key={c} className="ls-legend-item">
                  <span className="ls-legend-conf"
                    style={{ border: `${CONF_STROKE[c]}px solid var(--subtle)` }}
                  />
                  {c}
                </span>
              ))}
              <span className="ls-legend-item">
                <span className="ls-legend-minted" />
                Minted
              </span>
            </div>
          </div>
        </div>

        {/* Stats row */}
        <div className="ls-stats">
          <div>ROs: <span>{roCount}</span></div>
          <div>Clusters: <span>{clusterCount}</span></div>
          <div>Species: <span>{speciesSet.size}</span></div>
          {Object.entries(typeBreakdown).map(([type, count]) => (
            <div key={type}>
              {TYPE_LABELS[type as ROType] ?? type}: <span>{count}</span>
            </div>
          ))}
          {data && <div>Generated: <span>{new Date(data.timestamp).toLocaleTimeString()}</span></div>}
        </div>
      </div>
    </>
  );
}
