<script setup lang="ts">
import { computed, getCurrentInstance } from 'vue'

const props = defineProps<{ spotName?: string }>()
// Use the original attraction name so changing interface language does not reset the scene.
const scene = computed(() => /昆明湖|南湖岛|十七孔桥|玉带桥|石舫|铜牛/.test(props.spotName || '')
  ? 'lake' : /长廊|苏州街/.test(props.spotName || '') ? 'corridor' : 'garden')
const id = `guide-landscape-${getCurrentInstance()?.uid ?? 0}`
const paint = (name: string) => `url(#${id}-${scene.value}-${name})`
</script>

<template>
  <div class="guide-scenic-backdrop" :data-scene="scene" aria-hidden="true">
    <Transition name="scenic-fade">
      <svg :key="scene" class="garden-scenery" viewBox="0 0 900 800" preserveAspectRatio="xMidYMid slice" focusable="false">
        <defs>
          <linearGradient :id="`${id}-${scene}-mountain`" x1="0" y1="0" x2="0" y2="1">
            <stop stop-color="#b4b4dd" stop-opacity=".44" />
            <stop offset="1" stop-color="#d2dddf" stop-opacity=".08" />
          </linearGradient>
          <linearGradient :id="`${id}-${scene}-jade`" x1="0" y1="0" x2="0" y2="1">
            <stop stop-color="#a2c7c1" stop-opacity=".44" />
            <stop offset="1" stop-color="#cce1dd" stop-opacity=".12" />
          </linearGradient>
          <linearGradient :id="`${id}-${scene}-water`" x1="0" y1="0" x2="0" y2="1">
            <stop stop-color="#d4e8e7" stop-opacity=".22" />
            <stop offset="1" stop-color="#b9d9dd" stop-opacity=".5" />
          </linearGradient>
          <radialGradient :id="`${id}-${scene}-clearing`">
            <stop offset="0" stop-color="#fcfcff" stop-opacity=".96" />
            <stop offset=".6" stop-color="#fcfcff" stop-opacity=".65" />
            <stop offset="1" stop-color="#fcfcff" stop-opacity="0" />
          </radialGradient>
        </defs>

        <g class="garden-clouds" fill="none" stroke="#a5b5ce" stroke-width="1.2" opacity=".32" stroke-linecap="round">
          <path d="M32 164Q70 146 112 164T209 162M66 178H158M697 113Q738 95 778 113T883 115M746 129H856" />
        </g>
        <g class="garden-distance" :fill="paint('mountain')">
          <path d="M-60 478L36 383Q60 358 83 381L144 436L223 303Q247 263 278 309L360 448L448 503H-60Z" />
          <path d="M540 506L621 418L678 353Q702 325 727 356L766 403L834 287Q858 247 885 292L968 434V550H540Z" />
        </g>
        <path d="M-40 546Q78 480 173 509T329 546T523 540T717 505T946 520V800H-40Z" :fill="paint('jade')" />
        <path d="M-20 592Q151 567 310 594T598 586T930 585V820H-20Z" :fill="paint('water')" />

        <!-- These are decorative garden motifs, not reconstructions or navigation maps. -->
        <g v-if="scene === 'corridor'" class="garden-architecture" fill="#c7c8e1" fill-opacity=".18" stroke="#9da7c0" stroke-opacity=".55" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
          <path d="M-28 225Q47 242 126 200L253 285Q283 306 333 312L312 326Q268 322 237 307L127 242Q45 278-28 260Z" />
          <path d="M-15 264Q61 277 126 250L294 339M30 268V676M51 267V660M121 251V618M137 257V611M213 299V570M224 305V566M283 334V539" fill="none" />
          <path d="M22 678L309 533M50 660L309 533M-10 699L317 540M30 474L121 448L214 434M51 497L121 473M61 675L320 554" fill="none" />
          <path d="M928 225Q853 242 774 200L647 285Q617 306 567 312L588 326Q632 322 663 307L773 242Q855 278 928 260Z" />
          <path d="M915 264Q839 277 774 250L606 339M870 268V676M849 267V660M779 251V618M763 257V611M687 299V570M676 305V566M617 334V539" fill="none" />
          <path d="M878 678L591 533M850 660L591 533M910 699L583 540M870 474L779 448L686 434M849 497L779 473M839 675L580 554" fill="none" />
        </g>

        <g v-else-if="scene === 'lake'" class="garden-architecture" fill="none" stroke="#9aa8bd" stroke-width="1.7" stroke-opacity=".6" stroke-linejoin="round" stroke-linecap="round">
          <path d="M-18 587Q132 464 282 587M-18 598Q132 479 282 598M-5 578V591M24 558V570M54 541V553M86 529V541M119 524V536M151 525V537M184 532V544M216 546V558M246 564V576M273 584V596" />
          <path d="M11 610Q132 506 253 610M34 618V634M229 618V634" />
          <path d="M689 498H833M707 498V461H815V498M724 459V426H798V459M741 424V395H781V424M761 355V365" />
          <path d="M686 460Q724 459 761 437Q798 459 836 460ZM708 425Q736 422 761 403Q786 422 814 425ZM727 394Q750 390 761 365Q772 390 795 394Z" />
          <path d="M741 497V475H753V497M769 497V475H781V497M741 455V435M781 455V435M750 422V405M772 422V405" />
          <path d="M676 506Q753 515 846 504M688 515H822" />
        </g>

        <g v-else class="garden-architecture" fill="none" stroke="#9ba9bc" stroke-opacity=".55" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round">
          <path d="M-20 550H283M3 550V461H249V550M-16 459Q49 463 126 420Q203 463 268 459ZM25 451L126 400L227 451M126 399V386M31 549V476M221 549V476M62 549V479H96V549M158 549V479H192V549M105 475H149V550" />
          <path d="M655 560H931M670 560V494Q713 473 748 493V560M748 518H919M769 560V517M808 560V517M847 560V517M886 560V517M658 492Q701 487 712 468Q725 487 767 492" />
          <path d="M40 589Q107 566 175 587M697 583Q764 569 847 585" />
          <path d="M829 477Q813 436 834 411Q858 433 850 457Q871 421 889 441Q907 460 877 479M848 493L853 451M68 420Q49 385 60 368Q81 375 83 397Q93 364 114 380Q124 401 98 418" />
        </g>

        <g class="garden-ripples" fill="none" stroke="#8db6bf" stroke-opacity=".37" stroke-width="1.4" stroke-linecap="round">
          <path d="M-10 646Q102 629 207 648M50 668H152M17 691Q130 678 261 693M651 642Q757 626 914 643M736 665H865M672 693Q785 680 922 696M23 749H154M747 758H883" />
          <path d="M72 719H204M687 724H809M-2 774Q107 763 211 778M708 785Q798 770 913 782" />
        </g>
        <ellipse cx="450" cy="440" rx="250" ry="370" :fill="paint('clearing')" />
      </svg>
    </Transition>
    <div class="garden-ground"></div>
    <div class="garden-foot-shadow"></div>
  </div>
</template>

<style scoped>
.guide-scenic-backdrop { position:absolute; inset:0; overflow:hidden; pointer-events:none; background:radial-gradient(ellipse at 48% 27%,#fff 0%,#fcfcff 35%,transparent 72%),linear-gradient(145deg,#f0edfa 0%,#f7fafb 53%,#e5f0ef 100%); }
.garden-scenery { position:absolute; inset:0; width:100%; height:100%; }
.garden-distance { animation:garden-breathe 24s ease-in-out infinite alternate; transform-origin:50% 70%; }
.garden-clouds { animation:garden-cloud-drift 30s ease-in-out infinite alternate; }
.garden-ripples { animation:garden-water-drift 12s ease-in-out infinite alternate; }
.garden-ground { position:absolute; left:20%; right:20%; bottom:7.5%; height:9%; border-radius:50%; background:radial-gradient(ellipse,rgba(255,255,255,.86),rgba(248,251,251,.5) 54%,transparent 72%); }
.garden-foot-shadow { position:absolute; width:18%; max-width:150px; height:12px; bottom:10.8%; left:50%; transform:translateX(-50%); border-radius:50%; background:radial-gradient(ellipse,rgba(92,111,132,.2),rgba(124,141,158,.08) 48%,transparent 75%); filter:blur(2px); }
.scenic-fade-enter-active,.scenic-fade-leave-active { transition:opacity .55s ease; }
.scenic-fade-enter-from,.scenic-fade-leave-to { opacity:0; }
@keyframes garden-breathe { to { transform:translateY(3px) scale(1.012); } }
@keyframes garden-cloud-drift { to { transform:translateX(12px); } }
@keyframes garden-water-drift { to { transform:translateX(6px); opacity:.65; } }
@media (max-width:767px) { .garden-architecture { opacity:.65; } .garden-foot-shadow { height:6px; } }
@media (prefers-reduced-motion:reduce) { .garden-distance,.garden-clouds,.garden-ripples { animation:none; } .scenic-fade-enter-active,.scenic-fade-leave-active { transition:none; } }
</style>
