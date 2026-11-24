// Thin wrapper around cubiomes, exported to WebAssembly for the base finder page.
#include "cubiomes/generator.h"
#include "cubiomes/finders.h"
#include "cubiomes/util.h"
#include <stdlib.h>
#include <math.h>

uint64_t getPopulationSeed(int mc, uint64_t ws, int x, int z);   // defined in cubiomes/finders.c

static Generator g;
static uint64_t cur_seed;
static int mc = MC_NEWEST;

// Game version: a cubiomes version, plus g_ext for the changes after 1.21.4 (see biomes.h)
__attribute__((export_name("set_version")))
void set_version(int v, int ext) {
    mc = v; g_ext = ext;
    extern int dim_ready_reset(void); dim_ready_reset();
}

__attribute__((export_name("set_seed")))
void set_seed(int64_t seed) {
    cur_seed = (uint64_t)seed;
    setupGenerator(&g, mc, 0);
    applySeed(&g, DIM_OVERWORLD, cur_seed);
}

// ---- extra finders (Base Scout) ----
#define ST_FOSSIL       40   // fossil_upper: under the surface
#define ST_CAMP         41   // abandoned camp (26.3)
#define ST_FOSSIL_DEEP  42   // fossil_lower: deep, with diamond ore

static int camp_biome(int id) {
    switch (id) {
    case bamboo_jungle: case birch_forest: case cherry_grove: case dappled_forest: case flower_forest:
    case forest: case meadow: case old_growth_birch_forest: case old_growth_pine_taiga:
    case old_growth_spruce_taiga: case pale_garden: case savanna: case snowy_taiga: case sparse_jungle:
    case swamp: case taiga: case windswept_forest: case wooded_badlands:
        return 1;
    }
    return 0;
}
// Abandoned camp (26.3): random_spread spacing 37, separation 8, salt 91231127. Jigsaw start: one of
// 10 tents (8x8, or 6x8 for the 3rd and 8th), random rotation; biome checked at the tent's centre.
static int camp_at(int rx, int rz, Pos *p) {
    uint64_t s;
    setSeed(&s, rx*341873128712ULL + rz*132897987541ULL + cur_seed + 91231127ULL);
    int cx = rx * 37 + nextInt(&s, 29), cz = rz * 37 + nextInt(&s, 29);
    uint64_t r = chunkGenerateRnd(cur_seed, cx, cz);
    int rot = nextInt(&r, 4), t = nextInt(&r, 10);
    int sx = (t == 2 || t == 7) ? 6 : 8, sz = 8;
    int x0, x1, z0, z1;   // template box after rotating about the chunk corner
    switch (rot) {
    case 0:  x0 = 0;        x1 = sx - 1; z0 = 0;        z1 = sz - 1; break;
    case 1:  x0 = -(sz-1);  x1 = 0;      z0 = 0;        z1 = sx - 1; break;
    case 2:  x0 = -(sx-1);  x1 = 0;      z0 = -(sz-1);  z1 = 0;      break;
    default: x0 = 0;        x1 = sz - 1; z0 = -(sx-1);  z1 = 0;      break;
    }
    int bx = (cx * 32 + x0 + x1) / 2, bz = (cz * 32 + z0 + z1) / 2;   // Java int division
    int id = getBiomeAt(&g, 4, bx >> 2, 319 >> 2, bz >> 2);
    if (!camp_biome(id)) return 0;
    p->x = cx * 16; p->z = cz * 16;
    return 1;
}
// Fossils (1.18+): placed features fossil_upper / fossil_lower, step underground_structures,
// index 0 / 1 (salt 30000 / 30001): rarity 1/64, in_square, uniform height, biome filter.
static int fossil_at(int cx, int cz, int deep, Pos *p) {
    uint64_t s = getPopulationSeed(mc, cur_seed, cx * 16, cz * 16);
    Xoroshiro xr;
    xSetSeed(&xr, s + (deep ? 30001 : 30000));
    if (xNextFloat(&xr) >= 1.f / 64) return 0;
    int x = cx * 16 + xNextIntJ(&xr, 16), z = cz * 16 + xNextIntJ(&xr, 16);
    int y = deep ? xNextIntJ(&xr, 57) - 64 : xNextIntJ(&xr, 320);
    int id = getBiomeAt(&g, 1, x, y, z);
    if (!(id == desert || id == swamp || (id == mangrove_swamp && mc >= MC_1_19_2))) return 0;
    p->x = x; p->z = z;
    return 1;
}
static Pos *mbuf = 0;
static int extra_structs(int stype, int bx0, int bz0, int bx1, int bz1, int *out, int max) {
    int n = 0;
    if (stype == ST_CAMP) {
        if (!(mc >= MC_1_21_WD && g_ext >= EXT_26_3)) return 0;
        int rx0 = (int)floor(bx0 / (37.0*16)), rx1 = (int)floor(bx1 / (37.0*16));
        int rz0 = (int)floor(bz0 / (37.0*16)), rz1 = (int)floor(bz1 / (37.0*16));
        for (int rz = rz0; rz <= rz1; rz++) for (int rx = rx0; rx <= rx1; rx++) {
            Pos p;
            if (!camp_at(rx, rz, &p)) continue;
            if (p.x < bx0 || p.x > bx1 || p.z < bz0 || p.z > bz1) continue;
            if (n >= max) return n;
            out[2*n] = p.x; out[2*n+1] = p.z; n++;
        }
        return n;
    }
    int cx0 = bx0 >> 4, cx1 = bx1 >> 4, cz0 = bz0 >> 4, cz1 = bz1 >> 4;
    if (stype == ST_FOSSIL || stype == ST_FOSSIL_DEEP) {
        if (mc < MC_1_18) return 0;
        for (int cz = cz0; cz <= cz1; cz++) for (int cx = cx0; cx <= cx1; cx++) {
            Pos p;
            if (!fossil_at(cx, cz, stype == ST_FOSSIL_DEEP, &p)) continue;
            if (n >= max) return n;
            out[2*n] = p.x; out[2*n+1] = p.z; n++;
        }
        return n;
    }
    if (stype == Mineshaft) {
        int cap = max * 2 + 64;
        mbuf = realloc(mbuf, cap * sizeof(Pos));
        int m = getMineshafts(mc, cur_seed, cx0, cz0, cx1, cz1, mbuf, cap);
        if (m > cap) m = cap;
        for (int i = 0; i < m; i++) {
            int x = mbuf[i].x, z = mbuf[i].z;
            if (mc >= MC_1_18) {   // biome checked at (chunk middle x, y 50, chunk min z)
                int id = getBiomeAt(&g, 4, (x + 8) >> 2, 50 >> 2, z >> 2);
                if (!isViableFeatureBiome(mc, Mineshaft, id)) continue;
            }
            if (n >= max) return n;
            out[2*n] = x; out[2*n+1] = z; n++;
        }
        return n;
    }
    return -1;
}

__attribute__((export_name("alloc")))
void *wasm_alloc(int n) { return malloc(n); }

__attribute__((export_name("dealloc")))
void wasm_free(void *p) { free(p); }

// Biomes for `rows` rows of a grid at the given scale, starting at cell row `row0`.
// x0,z0 are in cells (block / scale). out must hold w*rows ints.
__attribute__((export_name("gen_rows")))
int gen_rows(int scale, int x0, int z0, int w, int row0, int rows, int y, int *out) {
    Range r = { scale, x0, z0 + row0, w, rows, y, 1 };
    return genBiomes(&g, out, r);
}

// All viable structures of a type inside the block box. out: x,z pairs. Returns count.
__attribute__((export_name("find_structs")))
int find_structs(int stype, int bx0, int bz0, int bx1, int bz1, int *out, int max) {
    if (stype == Mineshaft || stype >= 40) return extra_structs(stype, bx0, bz0, bx1, bz1, out, max);
    StructureConfig sc;
    if (!getStructureConfig(stype, mc, &sc)) return -1;
    int rs = sc.regionSize * 16;
    int rx0 = (int)floor((double)bx0 / rs), rx1 = (int)floor((double)bx1 / rs);
    int rz0 = (int)floor((double)bz0 / rs), rz1 = (int)floor((double)bz1 / rs);
    int n = 0;
    for (int rz = rz0; rz <= rz1; rz++)
        for (int rx = rx0; rx <= rx1; rx++) {
            Pos p;
            if (!getStructurePos(stype, mc, cur_seed, rx, rz, &p)) continue;
            if (p.x < bx0 || p.x > bx1 || p.z < bz0 || p.z > bz1) continue;
            if (!isViableStructurePos(stype, &g, p.x, p.z, 0)) continue;
            if (n >= max) return n;
            out[2*n] = p.x; out[2*n+1] = p.z; n++;
        }
    return n;
}

// Seed finder pre-check: where a structure type COULD be (its placement only, no biome check), so a
// seed with too few candidates near the target is dropped before any biome work. -1: not available.
__attribute__((export_name("find_raw")))
int find_raw(int stype, int bx0, int bz0, int bx1, int bz1, int *out, int max) {
    if (stype == Mineshaft || stype >= 40) return -1;
    StructureConfig sc;
    if (!getStructureConfig(stype, mc, &sc)) return -1;
    int rs = sc.regionSize * 16;
    int rx0 = (int)floor((double)bx0 / rs), rx1 = (int)floor((double)bx1 / rs);
    int rz0 = (int)floor((double)bz0 / rs), rz1 = (int)floor((double)bz1 / rs);
    int n = 0;
    for (int rz = rz0; rz <= rz1; rz++)
        for (int rx = rx0; rx <= rx1; rx++) {
            Pos p;
            if (!getStructurePos(stype, mc, cur_seed, rx, rz, &p)) continue;
            if (p.x < bx0 || p.x > bx1 || p.z < bz0 || p.z > bz1) continue;
            if (n >= max) return n;
            out[2*n] = p.x; out[2*n+1] = p.z; n++;
        }
    return n;
}

__attribute__((export_name("find_strongholds")))
int find_strongholds(int maxdist, int *out, int max) {
    StrongholdIter sh;
    initFirstStronghold(&sh, mc, cur_seed);
    int n = 0, more = 1;
    // nextStronghold fills sh.pos and returns how many remain after it
    while (n < max && more > 0) {
        more = nextStronghold(&sh, &g);
        double d2 = (double)sh.pos.x * sh.pos.x + (double)sh.pos.z * sh.pos.z;
        if (d2 <= (double)maxdist * maxdist) { out[2*n] = sh.pos.x; out[2*n+1] = sh.pos.z; n++; }
    }
    return n;
}

// Strongholds before the biome nudge (1.19.3+ only: there the nudge has its own random numbers, so the later
// strongholds do not depend on it). Each real one is within about 130 blocks of its rough spot. Very cheap.
__attribute__((export_name("strongholds_rough")))
int strongholds_rough(int *out, int max) {
    StrongholdIter sh;
    initFirstStronghold(&sh, mc, cur_seed);
    int n = 0, more = 1;
    while (n < max && more > 0) {
        more = nextStronghold(&sh, NULL);
        out[2*n] = sh.pos.x; out[2*n+1] = sh.pos.z; n++;
    }
    return n;
}

// Real strongholds within R of (x, z), nudging only the ones whose rough spot is close enough (1.19.3+: each nudge
// has its own random numbers, so skipping the others changes nothing). Older versions: all of them, as before.
__attribute__((export_name("strongholds_near")))
int strongholds_near(int x, int z, int R, int *out, int max) {
    StrongholdIter sh; initFirstStronghold(&sh, mc, cur_seed);
    int n = 0, more = 1;
    double reach = R + 140, dmax = sqrt((double)x * x + (double)z * z) + reach;
    while (more > 0 && n < max) {
        double ax = sh.nextapprox.x - x, az = sh.nextapprox.z - z;
        int near = ax * ax + az * az <= reach * reach;
        more = nextStronghold(&sh, (mc <= MC_1_19_2 || near) ? &g : NULL);
        double dx = sh.pos.x - x, dz = sh.pos.z - z;
        if (near && dx * dx + dz * dz <= (double)R * R) { out[2*n] = sh.pos.x; out[2*n+1] = sh.pos.z; n++; }
        if (sqrt((double)sh.pos.x * sh.pos.x + (double)sh.pos.z * sh.pos.z) > dmax + 1500 && sh.ringnum > 0) break;
    }
    return n;
}

// ---- Crack a seed (the SeedCrackerX method) ----
// Each structure: a list of places it could be (region and chunk inside the region), from the coordinates typed.
// hdr: per structure stype, first entry, entry count. ent: per entry regX, regZ, ox, oz (chunk inside the region).
void setAttemptSeed(uint64_t *s, int cx, int cz);
#define CK_K 0x5deece66dULL
#define CK_B 0xbULL
static int ck_liftbits(int range) {   // low bits of nextInt(range) that only depend on the low 20 seed bits
    if (!(range & (range - 1))) return 0;   // power of two: Java takes the top bits instead
    int k = 0; while (k < 3 && !(range & (1 << k))) k++;
    return k;
}
// Step 1: the low 20 bits. Returns how many fit (all of them written to out when there is room), -1 if none can
// be lifted (then all 2^20 fit and step 2 would take far too long).
__attribute__((export_name("crack_low")))
int crack_low(int n, const int *hdr, const int *ent, uint32_t *out, int maxout) {
    StructureConfig sc[24]; int k[24], lin[24], lifted = 0;
    for (int i = 0; i < n && i < 24; i++) {
        k[i] = 0; lin[i] = 0;
        if (!getStructureConfig(hdr[3*i], mc, &sc[i])) continue;
        lin[i] = !(hdr[3*i] == Monument || hdr[3*i] == Mansion);
        if (lin[i]) k[i] = ck_liftbits(sc[i].chunkRange);
        if (k[i]) lifted++;
    }
    if (!lifted) return -1;
    int found = 0;
    for (uint32_t L = 0; L < (1u << 20); L++) {
        int ok = 1;
        for (int i = 0; i < n && ok; i++) {
            if (!k[i]) continue;
            const uint64_t M20 = (1ULL << 20) - 1, km = (1ULL << k[i]) - 1;
            int hit = 0;
            for (int e = hdr[3*i+1]; e < hdr[3*i+1] + hdr[3*i+2] && !hit; e++) {
                const int *E4 = ent + 4*e;
                uint64_t s = (L + (uint64_t)E4[0] * 341873128712ULL + (uint64_t)E4[1] * 132897987541ULL + (uint64_t)(int64_t)sc[i].salt) & M20;
                s ^= CK_K & M20;
                s = (s * CK_K + CK_B) & M20;
                if (((s >> 17) & km) != ((uint64_t)E4[2] & km)) continue;
                s = (s * CK_K + CK_B) & M20;
                if (((s >> 17) & km) != ((uint64_t)E4[3] & km)) continue;
                hit = 1;
            }
            ok = hit;
        }
        if (ok) { if (found < maxout) out[found] = L; found++; }
    }
    return found;
}
// Step 2: the next 28 bits, for one low part L, upper parts H0 .. H0+count-1. Writes the 48-bit structure seeds
// whose placement fits every structure exactly.
__attribute__((export_name("crack_high")))
int crack_high(uint32_t L, uint32_t H0, uint32_t count, int n, const int *hdr, const int *ent, uint64_t *out, int maxout) {
    StructureConfig sc[24]; int big[24], outp[24];
    for (int i = 0; i < n && i < 24; i++) {
        getStructureConfig(hdr[3*i], mc, &sc[i]);
        big[i] = hdr[3*i] == Monument || hdr[3*i] == Mansion;
        outp[i] = hdr[3*i] == Outpost;
    }
    int found = 0;
    for (uint32_t h = 0; h < count; h++) {
        uint64_t s48 = ((uint64_t)(H0 + h) << 20) | L;
        int ok = 1;
        for (int i = 0; i < n && ok; i++) {
            int hit = 0;
            for (int e = hdr[3*i+1]; e < hdr[3*i+1] + hdr[3*i+2] && !hit; e++) {
                const int *E4 = ent + 4*e;
                Pos p = big[i] ? getLargeStructureChunkInRegion(sc[i], s48, E4[0], E4[1]) : getFeatureChunkInRegion(sc[i], s48, E4[0], E4[1]);
                if (p.x != E4[2] || p.z != E4[3]) continue;
                if (outp[i]) {   // outposts: one placement in five is kept
                    uint64_t a = s48;
                    setAttemptSeed(&a, E4[0] * sc[i].regionSize + E4[2], E4[1] * sc[i].regionSize + E4[3]);
                    if (nextInt(&a, 5) != 0) continue;
                }
                hit = 1;
            }
            ok = hit;
        }
        if (ok) { if (found < maxout) out[found] = s48; found++; }
    }
    return found;
}

// Fixed spots, step 1 (the SeedCrackerX idea): where structures can go depends only on the lower 48 bits of
// the seed. Walk structure seeds (48-bit LCG, full period) from `state`, keep the ones whose placement fits every
// pin. spec per pin: stype (-2 stronghold rough, -1 not checkable here), x, z, r. Returns matches written to out.
__attribute__((export_name("pin_scan")))
int pin_scan(uint64_t state, int count, int npins, const int *spec, uint64_t *out, int maxout) {
    const uint64_t M = (1ULL << 48) - 1;
    int found = 0;
    StructureConfig sc[16]; int rs[16];
    for (int k = 0; k < npins && k < 16; k++) {
        rs[k] = 0;
        if (spec[4*k] >= 0 && getStructureConfig(spec[4*k], mc, &sc[k])) rs[k] = sc[k].regionSize * 16;
    }
    for (int i = 0; i < count; i++) {
        state = (state * 0x5DEECE66DULL + 0xBULL) & M;
        uint64_t s48 = state;
        int ok = 1;
        for (int k = 0; k < npins && ok; k++) {
            int st = spec[4*k], x = spec[4*k+1], z = spec[4*k+2], r = spec[4*k+3];
            double r2 = (double)r * r;
            if (st == -2) {
                if (mc <= MC_1_19_2) continue;
                StrongholdIter sh; initFirstStronghold(&sh, mc, s48);
                int more = 1, hit = 0; double R = r + 140;
                double dmax = sqrt((double)x * x + (double)z * z) + R;
                while (more > 0) {
                    more = nextStronghold(&sh, NULL);
                    double dx = sh.pos.x - x, dz = sh.pos.z - z;
                    if (dx * dx + dz * dz <= R * R) { hit = 1; break; }
                    if (sqrt((double)sh.pos.x * sh.pos.x + (double)sh.pos.z * sh.pos.z) > dmax + 1500 && sh.ringnum > 0) break;
                }
                ok = hit; continue;
            }
            if (!rs[k]) continue;
            int rx0 = (int)floor((double)(x - r) / rs[k]), rx1 = (int)floor((double)(x + r) / rs[k]);
            int rz0 = (int)floor((double)(z - r) / rs[k]), rz1 = (int)floor((double)(z + r) / rs[k]);
            int hit = 0;
            for (int rz = rz0; rz <= rz1 && !hit; rz++)
                for (int rx = rx0; rx <= rx1 && !hit; rx++) {
                    Pos p;
                    if (!getStructurePos(st, mc, s48, rx, rz, &p)) continue;
                    double dx = p.x - x, dz = p.z - z;
                    if (dx * dx + dz * dz <= r2) hit = 1;
                }
            ok = hit;
        }
        if (ok) { out[found++] = s48; if (found >= maxout) { out[found] = state; return -found; } }
    }
    out[found] = state;   // where to carry on
    return found;
}

__attribute__((export_name("spawn")))
void spawn(int *out) { Pos p = getSpawn(&g); out[0] = p.x; out[1] = p.z; }

__attribute__((export_name("colors")))
void colors(unsigned char *out) {
    initBiomeColors((unsigned char (*)[3])out);
    out[3*dappled_forest] = 0xd2; out[3*dappled_forest+1] = 0x6a; out[3*dappled_forest+2] = 0x2a;   // autumn orange
    out[3*sulfur_caves] = 0xc8; out[3*sulfur_caves+1] = 0xb4; out[3*sulfur_caves+2] = 0x32;
}

__attribute__((export_name("biome_name")))
const char *biome_name(int id) { return biome2str(mc, id); }

// ---- Nether and End: their own generators, so the Overworld search is never disturbed ----
static Generator gdim[2];           // 0 = Nether, 1 = End
static uint64_t dim_seed[2];
static int dim_ready[2];
int dim_ready_reset(void) { dim_ready[0] = dim_ready[1] = 0; return 0; }
static SurfaceNoise sn_end;

__attribute__((export_name("set_seed_dim")))
void set_seed_dim(int dim, int64_t seed) {
    int i = dim == DIM_END;
    if (dim_ready[i] && dim_seed[i] == (uint64_t)seed) return;
    setupGenerator(&gdim[i], mc, 0);
    applySeed(&gdim[i], i ? DIM_END : DIM_NETHER, (uint64_t)seed);
    if (i) initSurfaceNoise(&sn_end, DIM_END, (uint64_t)seed);
    dim_seed[i] = (uint64_t)seed; dim_ready[i] = 1;
}

__attribute__((export_name("gen_rows_dim")))
int gen_rows_dim(int dim, int scale, int x0, int z0, int w, int row0, int rows, int y, int *out) {
    Range r = { scale, x0, z0 + row0, w, rows, y, 1 };
    return genBiomes(&gdim[dim == DIM_END], out, r);
}

__attribute__((export_name("find_structs_dim")))
int find_structs_dim(int dim, int stype, int bx0, int bz0, int bx1, int bz1, int *out, int max) {
    int i = dim == DIM_END;
    Generator *gg = &gdim[i];
    StructureConfig sc;
    if (!getStructureConfig(stype, mc, &sc)) return -1;
    int rs = sc.regionSize * 16;
    int rx0 = (int)floor((double)bx0 / rs), rx1 = (int)floor((double)bx1 / rs);
    int rz0 = (int)floor((double)bz0 / rs), rz1 = (int)floor((double)bz1 / rs);
    int n = 0;
    for (int rz = rz0; rz <= rz1; rz++)
        for (int rx = rx0; rx <= rx1; rx++) {
            Pos p;
            if (!getStructurePos(stype, mc, dim_seed[i], rx, rz, &p)) continue;
            if (p.x < bx0 || p.x > bx1 || p.z < bz0 || p.z > bz1) continue;
            if (!isViableStructurePos(stype, gg, p.x, p.z, 0)) continue;
            if (stype == End_City && !isViableEndCityTerrain(gg, &sn_end, p.x, p.z)) continue;
            if (n >= max) return n;
            out[2*n] = p.x; out[2*n+1] = p.z; n++;
        }
    return n;
}

// End terrain height (0 = void) on a grid; x,z,w,h are in units of 8/scale blocks.
__attribute__((export_name("end_height")))
int end_height(int x, int z, int w, int h, int scale, float *out) {
    return mapEndSurfaceHeight(out, &gdim[1].en, &sn_end, x, z, w, h, scale, 0);
}

// End city at block x,z: 1 if it has an End ship (the elytra), with the ship's centre in out[0..2] (x, y, z).
static Piece city_pieces[END_CITY_PIECES_MAX];
__attribute__((export_name("end_city_ship")))
int end_city_ship(int x, int z, int *out) {
    int n = getEndCityPieces(city_pieces, dim_seed[1], x >> 4, z >> 4);
    for (int i = 0; i < n; i++)
        if (city_pieces[i].type == END_SHIP) {
            out[0] = (city_pieces[i].bb0.x + city_pieces[i].bb1.x) / 2;
            out[1] = (city_pieces[i].bb0.y + city_pieces[i].bb1.y) / 2;
            out[2] = (city_pieces[i].bb0.z + city_pieces[i].bb1.z) / 2;
            return 1;
        }
    return 0;
}

// The 20 gateways around the main island, in the order they open (one per dragon kill),
// each followed by where it sends you on the outer islands. out: 20 x (sx, sz, dx, dz).
__attribute__((export_name("end_gateways")))
int end_gateways(int *out) {
    Pos src[20];
    getFixedEndGateways(mc, dim_seed[1], src);
    for (int i = 0; i < 20; i++) {
        Pos d = getLinkedGatewayPos(&gdim[1].en, &sn_end, dim_seed[1], src[i]);
        out[4*i] = src[i].x; out[4*i+1] = src[i].z; out[4*i+2] = d.x; out[4*i+3] = d.z;
    }
    return 20;
}

// Bastion type at block x,z: 0 housing units, 1 hoglin stables, 2 treasure room, 3 bridge.
__attribute__((export_name("bastion_type")))
int bastion_type(int x, int z) {
    StructureVariant v;
    getVariant(&v, Bastion, mc, dim_seed[0], x, z, -1);
    return v.start;
}
