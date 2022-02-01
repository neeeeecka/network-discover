import { open, close, readFile } from "fs";
import { exec } from "child_process";
import Database from "./db.js";

let data = {
  current: {
    pings: [],
    lookup: [],
    arped: [],
  },
};

const database = new Database("./data.json");

findRaspberry();

function ResolveAll(promises, onProgress) {
  return new Promise((resolve, reject) => {
    const resolved = [];
    let finsihed = 0;

    const handleResult = () => {
      finsihed++;
      onProgress(finished / promises.length);
      if (finsihed == promises.length) {
        resolve(resolved);
      }
    };

    promises.forEach((promise) => {
      promise
        .then((result) => {
          resolved.push(result);
          handleResult();
        })
        .catch((message) => {
          handleResult();
        });
    });
  });
}

function ping(ip) {
  return new Promise((resolve, reject) => {
    exec(`ping -c 3 ${ip}`, (error, stdout, stderr) => {
      if (error) {
        reject(error);
        return;
      }
      if (stderr) {
        reject(sterr);
        return;
      }

      setTimeout(() => {
        reject("Timeout");
      }, 4000);

      resolve(ip);
    });
  });
}

function arp(ip) {
  return new Promise((resolve, reject) => {
    exec(
      `arping -c 3 -i wlo1 -U -S 192.168.100.17 ${ip}`,
      (error, stdout, sterr) => {
        if (error) {
          reject(error);
          return;
        }
        if (sterr) {
          reject(sterr);
          return;
        }

        setTimeout(() => {
          reject("Timeout");
        }, 4000);

        const macmatch = stdout.match(
          /([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})/gm
        );
        if (macmatch && macmatch.length > 0) {
          const mac = macmatch[0];
          const lookup = mac.slice(0, 8).toUpperCase();
          const res = { mac, lookup, ip };
          resolve(res);
          return;
        }
        reject("Bad mac");
        return;
      }
    );
  });
}

function progressBar(fraction) {}

async function findRaspberry() {
  const pings = [];
  for (let i = 0; i < 255; i++) {
    pings.push(ping(`192.168.100.${i}`));
  }
  console.log("Resolving ips...");

  const resolvedIps = await ResolveAll(pings, progressBar);
  const arps = [];
  resolvedIps.forEach((ip) => {
    arps.push(arp(ip));
  });

  console.log("Resolving macs...");
  const resolvedMacs = await ResolveAll(arps, progressBar);

  console.log("Discovering vendors...");
  const resolvedVendors = await discoverVendors(resolvedMacs, progressBar);

  console.log(resolvedVendors);
}

function discoverVendors(lookups, onProgress) {
  return new Promise((resolve, reject) => {
    const resolvedVendors = [];

    readFile("./vendors.json", (err, buffer) => {
      const vendors = JSON.parse(buffer.toString());

      vendors.forEach((vendor, i) => {
        lookups.forEach((toLookup) => {
          const { lookup, mac, ip } = toLookup;

          if (vendor.macPrefix.includes(lookup)) {
            resolvedVendors.push({ ...toLookup, vendor: vendor.vendorName });
          }
        });
        onProgress(i / vendors.length);
      });

      resolve(resolvedVendors);
    });
  });
}
