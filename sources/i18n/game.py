import json
LS=['fr_fr','es_es','de_de','it_it','pt_br','pl_pl','nl_nl']
L={l:json.load(open(f'lang/{l}.json')) for l in ['en_us']+LS}
G={}
for k,v in L['en_us'].items():
    if k.startswith(('biome.minecraft.','enchantment.minecraft.')) and k.count('.')==2:
        G[v.lower()]=[L[l].get(k,v) for l in LS]
for k in ['item.minecraft.paper','block.minecraft.bookshelf','item.minecraft.enchanted_book','item.minecraft.emerald','item.minecraft.book','block.minecraft.lantern','item.minecraft.clock','item.minecraft.compass','block.minecraft.glass','item.minecraft.ink_sac','item.minecraft.writable_book','block.minecraft.yellow_candle','block.minecraft.red_candle']:
    G[L['en_us'][k].lower()]=[L[l][k] for l in LS]
for k in json.load(open('job_keys.json')) + json.load(open('loot_keys.json')):   # names used by the villager jobs (written by jobs.py)
    if k in L['en_us']: G[L['en_us'][k].lower()]=[L[l].get(k,L['en_us'][k]) for l in LS]
json.dump(G,open('game.json','w'),ensure_ascii=False)
print(len(G)); print(G['windswept hills'], G['mountain peaks'] if 'mountain peaks' in G else 'no peaks')
