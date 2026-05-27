---
---

# Benchmark

SlimFact is designed to be highly performant. Shown below are some benchmarks obtained with [k6](https://k6.io/).

## k6

```bash
sudo lshw -short
H/W path           Device          Class          Description
=============================================================
                                   system         Laptop (FRANBMCP0A)
/0                                 bus            FRANBMCP0A
/0/0                               memory         128KiB BIOS
/0/4                               processor      11th Gen Intel(R) Core(TM) i5-1135G7 @ 2.40GHz
/0/4/6                             memory         128KiB L1 cache
/0/4/7                             memory         5MiB L2 cache
/0/4/8                             memory         8MiB L3 cache
/0/5                               memory         192KiB L1 cache
/0/14                              memory         32GiB System Memory
/0/14/0                            memory         16GiB SODIMM DDR4 Synchronous 3200 MHz (0,3 ns)
/0/14/1                            memory         16GiB SODIMM DDR4 Synchronous 3200 MHz (0,3 ns)
/0/100                             bridge         Tiger Lake-UP3/H35 4 cores Host Bridge/DRAM Registers
/0/100/2           /dev/fb0        display        TigerLake-LP GT2 [Iris Xe Graphics]
/0/100/4                           generic        TigerLake-LP Dynamic Tuning Processor Participant
/0/100/6                           bridge         11th Gen Core Processor PCIe Controller
/0/100/6/0         /dev/nvme0      storage        WDS500G1X0E-00AFY0
/0/100/6/0/0       hwmon3          disk           NVMe disk
/0/100/6/0/2       /dev/ng0n1      disk           NVMe disk
/0/100/6/0/1       /dev/nvme0n1    disk           500GB NVMe disk
/0/100/6/0/1/1                     volume         511MiB Windows FAT volume
/0/100/6/0/1/2     /dev/nvme0n1p2  volume         465GiB EXT4 volume


sudo docker compose -f docker-compose.k6.yaml up --force-recreate
K6_BROWSER_EXECUTABLE_PATH=/usr/bin/chromium K6_BROWSER_ARGS="ignore-certificate-errors" K6_BROWSER_HEADLESS=true k6 run --summary-trend-stats="med,p(95),p(99.9)" tests/k6/user-register.ts
```

### User registration and login

With 10 Virtual Users. Registration and login requires a browser to complete the PKCE challenge, but it quickly runs in to the memory limits of the testing system.

```bash
         /\      Grafana   /‾‾/
    /\  /  \     |\  __   /  /
   /  \/    \    | |/ /  /   ‾‾\
  /          \   |   (  |  (‾)  |
 / __________ \  |_|\_\  \_____/


     execution: local
        script: tests/k6/user-register.ts
        output: -

     scenarios: (100.00%) 1 scenario, 10 max VUs, 10m30s max duration (incl. graceful stop):
              * test: 100 iterations shared among 10 VUs (maxDuration: 10m0s, gracefulStop: 30s)

  █ THRESHOLDS

    checks
    ✓ 'rate==1.0' rate=0.00%


  █ TOTAL RESULTS

    checks_total.......: 0     0/s
    checks_succeeded...: 0.00% 0 out of 0
    checks_failed......: 0.00% 0 out of 0


    EXECUTION
    iteration_duration..........: med=13.16s   p(95)=16.08s   p(99.9)=38.26s
    iterations..................: 100    0.639036/s
    vus.........................: 1      min=0         max=10
    vus_max.....................: 10     min=0         max=10

    NETWORK
    data_received...............: 0 B    0 B/s
    data_sent...................: 0 B    0 B/s

    BROWSER
    browser_data_received.......: 624 MB 4.0 MB/s
    browser_data_sent...........: 2.1 MB 13 kB/s
    browser_http_req_duration...: med=65.67ms  p(95)=680.68ms p(99.9)=1.23s
    browser_http_req_failed.....: 0.00%  0 out of 7658

    WEB_VITALS
    browser_web_vital_cls.......: med=0.000075 p(95)=0.027834 p(99.9)=0.036621
    browser_web_vital_fcp.......: med=1.43s    p(95)=2.84s    p(99.9)=3.77s
    browser_web_vital_inp.......: med=352ms    p(95)=452.79ms p(99.9)=463.77ms
    browser_web_vital_lcp.......: med=1.5s     p(95)=2.82s    p(99.9)=3.71s
    browser_web_vital_ttfb......: med=58.89ms  p(95)=632.53ms p(99.9)=1.23s




running (02m36.5s), 00/10 VUs, 100 complete and 0 interrupted iterations
test ✓ [ 100% ] 10 VUs  02m36.5s/10m0s  100/100 shared iters
```

### Creating invoices with API calls

The maximum requests per seconds averages at ~162 (~14M per day). If you require higher performance, please contact me so we can look at what is achievable. Please note that database storage should be your main concern in that case.

```bash
         /\      Grafana   /‾‾/
    /\  /  \     |\  __   /  /
   /  \/    \    | |/ /  /   ‾‾\
  /          \   |   (  |  (‾)  |
 / __________ \  |_|\_\  \_____/


     execution: local
        script: tests/k6/create-invoices.ts
        output: -

     scenarios: (100.00%) 1 scenario, 10 max VUs, 10m40s max duration (incl. graceful stop):
              * test: 10 iterations shared among 10 VUs (maxDuration: 10m0s, startTime: 10s, gracefulStop: 30s)

  █ THRESHOLDS

    checks
    ✓ 'rate==1.0' rate=0.00%


  █ TOTAL RESULTS

    checks_total.......: 0     0/s
    checks_succeeded...: 0.00% 0 out of 0
    checks_failed......: 0.00% 0 out of 0


    HTTP
    http_req_duration..............: med=141.44ms p(95)=801.26ms p(99.9)=853.66ms
      { expected_response:true }...: med=141.44ms p(95)=801.26ms p(99.9)=853.66ms
    http_req_failed................: 0.00%  0 out of 13532
    http_reqs......................: 13532  162.075826/s

    EXECUTION
    iteration_duration.............: med=1m11s    p(95)=1m12s    p(99.9)=1m12s
    iterations.....................: 10     0.119772/s
    vus............................: 4      min=0          max=10
    vus_max........................: 10     min=0          max=10

    NETWORK
    data_received..................: 81 MB  969 kB/s
    data_sent......................: 70 MB  836 kB/s

    BROWSER
    browser_data_received..........: 50 MB  596 kB/s
    browser_data_sent..............: 205 kB 2.4 kB/s
    browser_http_req_duration......: med=90.58ms  p(95)=785.41ms p(99.9)=1.83s
    browser_http_req_failed........: 0.00%  0 out of 718

    WEB_VITALS
    browser_web_vital_cls..........: med=0.000132 p(95)=0.010088 p(99.9)=0.016465
    browser_web_vital_fcp..........: med=1.69s    p(95)=3.01s    p(99.9)=3.21s
    browser_web_vital_lcp..........: med=2.54s    p(95)=3s       p(99.9)=3.19s
    browser_web_vital_ttfb.........: med=68ms     p(95)=721.21ms p(99.9)=740.98ms




running (01m23.5s), 00/10 VUs, 10 complete and 0 interrupted iterations
test ✓ [======================================] 10 VUs  01m13.5s/10m0s  10/10 shared iters
```
