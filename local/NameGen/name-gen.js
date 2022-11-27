const generator = require("generate-password");
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const cheerio = require("cheerio");
const fs = require("fs");
const { faker } = require('@faker-js/faker');


// let password = faker.internet.password();
//
// await page.type('input[name=Passwd]',password)
// await page.type('input[name=ConfirmPasswd]',password)
//
// await page.type('input[name=firstName]', faker.name.firstName());
// await page.type('input[name=lastName]', faker.name.lastName());
// await page.type('input[type=email]', faker.internet.userName()+"15463");

const url = "https://www.fakenamegenerator.com/advanced.php?t=country&n%5B%5D=us&c%5B%5D=us&gen=50&age-min=19&age-max=51";

const batchSize = 5;
// var $ = null;
// const email = () => {
//     // Regular expression to determine if the text has parentheses.
// const head = el.find("dt").first();
// const headText = head.text().toLowerCase();
// console.log("head", headText);
// if (headText.includes("email")) {
//     return el.find("dd").first().text();
// }

//     return null;
// };

async function main() {
    const array = [];
    for (let i = 0; i < batchSize; i++) {
        const row = {};
        const response = await fetch(url);
        const html = await response.text();
        // console.log(html);
        const $ = cheerio.load(html);
        const infoSection = $("div.address", html);

        row.name = infoSection.first().find("h3").first().text();
        row.fakeAddress = infoSection.first().find("div.adr").first().text().replace("\n", "").trim();
        const dls = $("dl.dl-horizontal");

        dls.each(function () {
            var el = $(this);
            // console.log(el.text());
            const head = el.find("dt").first();
            const headText = head.text().toLowerCase();
            // console.log("head", headText);
            if (headText.includes("email")) {
                row.recoveryEmail = el.find("dd").first().text().split(" ")[0];
                row.workFakeEmail = el.find("div.adtl").find("a").first().attr("href");
            }
            if (headText.includes("vehicle")) {
                row.vehicle = el.find("dd").first().text();
            }
            if (headText.includes("favorite color")) {
                row.favoriteColor = el.find("dd").first().text();
            }
            if (headText.includes("birthday")) {
                row.birthday = el.find("dd").first().text();
            }
            // if (headText.includes("age")) {
            //     row.age = el.find("dd").first().text();
            // }
            if (headText.includes("phone")) {
                row.phone = el.find("dd").first().text();
            }
            if (headText.includes(" maiden name")) {
                row.maidenName = el.find("dd").first().text();
            }
            row.password = generator.generate({
                length: 10,
                numbers: true,
            });
            row.gmail =
                `${row.recoveryEmail}`.split("@")[0] +
                generator.generate({
                    length: 4,
                    numbers: true,
                }) +
                "@gmail.com";
            row.gmail = row.gmail.toLowerCase();
            row.recoveryEmail = `${row.recoveryEmail}`.toLowerCase();
        });

        // console.log(row, dls.length);
        array.push(row);
    }
    for (let i in array) {
        console.log(`\n\n[${Number(i) + 1}] ===========`);
        const row = array[i];
        const keys = Object.keys(row);
        console.log(" -- -- -- --");
        console.log(
            `Name:      ${row.name}     |          Date of birth:    ${row.birthday}     |          GMAIL:    ${row.gmail}        |          password:    ${row.password}     `
        );
        console.log(`Recovery Email:      ${row.recoveryEmail}  `);
        console.log("ADDRES FROM GOOGLE PAY ******************\n\n");
        console.log("ADDRES FROM GOOGLE PAY ******************");

        console.log(`Fake Address:      ${row.fakeAddress}  `);

        console.log(" -- -- -- --");
        for (let j in keys) {
            console.log(`  --  ${keys[j]}  +  ${row[keys[j]]}`);
        }

        console.log(`[${Number(i) + 1}] -------------- \n\n`);
        const forImport = { ...row };
        const __names = forImport.name.split(" ");
        forImport.firstName = __names[0];
        forImport.lastName = __names.length === 2 ? __names[1] : __names.length > 2 ? __names[2] : "";
        forImport.address = row.fakeAddress;
        forImport.dob = row.birthday;
        forImport.lang = "en";
        forImport.billingCountry = "us";
        forImport.phone = "+1"+row.phone.replace(/[^0-9]/g, "");
        console.log(JSON.stringify(forImport));
        console.log(``);
        console.log(`[${Number(i) + 1}] ===========\n\n`);
    }
}

main();
