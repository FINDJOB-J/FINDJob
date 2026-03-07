exports.handler = async function(event) {
  const { keyword, page = 1 } = event.queryStringParameters || {};
  const API_KEY = 'a0f36312-1108-45af-936c-598ae1f69ea2';

  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json; charset=utf-8'
  };

  if (!keyword) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'keyword 필요' }) };
  }

  // 고용24 채용정보 API 공식 명세: returnType은 소문자 xml, 필수 authKey/callTp/returnType/startPage/display
  const encodedKeyword = encodeURIComponent(keyword);
  const url = `https://www.work24.go.kr/cm/openApi/call/wk/callOpenApiSvcInfo210L01.do?authKey=${API_KEY}&callTp=L&returnType=xml&startPage=${page}&display=20&keyword=${encodedKeyword}&sortOrderBy=DESC`;

  try {
    const res = await fetch(url, {
      headers: {
        'Accept': 'application/xml, text/xml, */*',
        'Accept-Charset': 'UTF-8',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    const buffer = await res.arrayBuffer();
    const xml = new TextDecoder('utf-8').decode(buffer);

    // API 오류 응답 처리 (예: 서비스를 이용하지 못하고 있습니다 → 권한/인증키 미승인)
    const errorMatch = xml.match(/<error>([\s\S]*?)<\/error>/);
    if (errorMatch) {
      const safeUrl = url.replace(/authKey=[^&]+/, 'authKey=***');
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          error: errorMatch[1].trim(),
          errorType: 'api_error',
          hint: '인증키가 채용정보 API에 승인되었는지 고용24 OPEN-API 신청현황에서 확인하세요.',
          debug_url: safeUrl
        })
      };
    }

    const totalMatch = xml.match(/<total>(\d+)<\/total>/);
    const total = totalMatch ? totalMatch[1] : '0';

    // XML을 JSON으로 변환
    const items = [];
    const wantedMatches = xml.match(/<wanted>([\s\S]*?)<\/wanted>/g) || [];

    for (const item of wantedMatches) {
      const get = (tag) => {
        const m = item.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`));
        return m ? m[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim() : '';
      };
      items.push({
        wantedAuthNo: get('wantedAuthNo'),
        company: get('company'),
        title: get('title'),
        region: get('region'),
        career: get('career'),
        salTpNm: get('salTpNm'),
        sal: get('sal'),
        closeDt: get('closeDt'),
        wantedInfoUrl: get('wantedInfoUrl')
      });
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ total, items, debug_url: url })
    };
  } catch (e) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
  }
};
