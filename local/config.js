const env = process.env;

const config = {
    LocalPath: env.GoLocalPath || 'C:\\Users\\Borhan\\Desktop\\Gologin\\tt',
    GoToken: env.GoToken || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2MmRlZjQ4Y2IyYmQ0ZjUzMmUxMGY4ZWYiLCJ0eXBlIjoiZGV2Iiwiand0aWQiOiI2MmRmMzRmODBmYTgzMWQ1Y2Y2YTllYmEifQ.a3_o6_pHsTP9lIQOUXfCHN1pn5X6FpMgcL-IUxDbMuA',
    GoDB: env.GoDB || 'sysA.db',
}

module.exports = config;