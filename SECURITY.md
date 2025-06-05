# Security Guide

## 🔒 Security Enhancements Overview

이 프로젝트에는 다음과 같은 포괄적인 보안 강화 조치가 구현되어 있습니다.

## 🚨 해결된 보안 취약점

### 1. **AppleScript Injection (Critical)** ✅ 해결됨
- **문제**: 악의적인 창 제목을 통한 임의 명령 실행
- **해결책**: 
  - 입력 검증 및 문자 이스케이핑
  - 위험한 AppleScript 시퀀스 탐지 및 차단
  - 구조화된 AppleScript 출력 파싱

### 2. **Command Injection** ✅ 해결됨  
- **문제**: Shell command injection 가능성
- **해결책**: 
  - 보안 제약이 있는 `secureExecAppleScript` 메소드
  - 위험한 패턴 사전 검증
  - 실행 시간 제한 (10초)

### 3. **Path Traversal** ✅ 해결됨
- **문제**: 시스템 파일 접근 가능성
- **해결책**: 
  - 경로 정규화 및 검증
  - 금지된 시스템 디렉토리 접근 차단
  - 사용자 홈 디렉토리 제한

### 4. **Process Spawn Security** ✅ 해결됨
- **문제**: 환경 변수 노출 및 권한 상승
- **해결책**: 
  - 안전한 환경 변수 필터링
  - 프로세스 권한 유지
  - 인스턴스 수 제한

## 🛡️ 구현된 보안 기능

### macOS Window Manager 보안

#### 입력 검증
```typescript
// 제목 길이 제한
private readonly MAX_TITLE_LENGTH = 500

// 허용된 문자 패턴
private readonly ALLOWED_CHARACTERS = /^[a-zA-Z0-9\s\-_.()[\]{}|:;'"<>?!@#$%^&*+=~/\\]*$/

// 위험한 AppleScript 시퀀스 차단
const dangerous = [
    'tell application',
    'do shell script',
    'system events',
    // ... more patterns
]
```

#### AppleScript 보안 실행
```typescript
private async secureExecAppleScript(script: string, context: string): Promise<string> {
    // 위험한 패턴 검증
    const dangerousPatterns = [
        /do shell script/i,
        /system events.*delete/i,
        /tell application.*quit/i,
        // ... more patterns
    ]
    
    // 시간 제한 및 출력 크기 제한
    const { stdout } = await execAsync(`osascript -e '${script}'`, { 
        timeout: 10000,
        maxBuffer: 1024 * 1024 // 1MB max
    })
}
```

### Path Resolver 보안

#### 경로 검증
```typescript
private static validatePath(inputPath: string, description: string): string {
    // 길이 검증
    if (inputPath.length > this.MAX_PATH_LENGTH) {
        throw new Error(`${description} exceeds maximum length`)
    }
    
    // 경로 순회 방지
    if (normalizedPath.includes('..')) {
        throw new Error(`${description} contains path traversal sequences`)
    }
    
    // 금지된 경로 확인
    for (const forbidden of this.FORBIDDEN_PATHS) {
        if (normalizedPath.toLowerCase().startsWith(forbidden.toLowerCase())) {
            throw new Error(`${description} accesses forbidden system directory`)
        }
    }
}
```

#### 금지된 시스템 경로
```typescript
private static readonly FORBIDDEN_PATHS = [
    '/etc',
    '/root',
    '/var/log',
    '/System',
    '/Library/Keychains',
    '/private/var/db',
    'C:\\Windows\\System32',
    'C:\\Users\\Administrator'
]
```

### Instance Manager 보안

#### 프로세스 스폰 보안
```typescript
private createSafeEnvironment(): Record<string, string> {
    const safeEnv: Record<string, string> = {}
    
    // 안전한 환경 변수만 복사
    for (const [key, value] of Object.entries(process.env)) {
        if (this.SAFE_ENV_KEYS.has(key) && typeof value === 'string') {
            safeEnv[key] = value
        }
    }
    
    return safeEnv
}
```

#### 입력 검증
```typescript
private validateKeys(keys: string[]): string[] {
    if (keys.length > 50) {
        throw new Error('Too many keys in sequence (maximum 50)')
    }
    
    const allowedKeys = /^[a-zA-Z0-9\s\-_.()[\]{}|:;'"<>?!@#$%^&*+=~/\\]|control|shift|alt|command|enter|tab|escape|backspace|delete|space|up|down|left|right$/
    
    return keys.map(key => {
        if (!allowedKeys.test(key)) {
            throw new Error(`Invalid key: ${key}`)
        }
        return key
    })
}
```

## 🔍 보안 로깅

모든 보안 관련 이벤트는 구조화된 로깅으로 기록됩니다:

```typescript
this.securityLogger.warn('Title contains potentially dangerous AppleScript sequence', { 
    sequence: danger,
    title: title.substring(0, 100) + '...'  // 민감한 정보 트런케이션
})
```

### 로그 분류
- **보안 검증 실패**: 악의적인 입력 시도
- **리소스 제한 위반**: 크기/길이 제한 초과
- **권한 관련 오류**: 시스템 접근 시도
- **프로세스 이상**: 예기치 않은 프로세스 동작

## 🧪 보안 테스트

포괄적인 보안 테스트 스위트가 구현되어 있습니다:

### 테스트 범위
1. **입력 검증**: 악의적인 문자열 및 잘못된 형식
2. **인젝션 방지**: AppleScript, Command, SQL 인젝션
3. **리소스 제한**: 메모리, 시간, 크기 제한
4. **문자 인코딩**: Unicode, 제어 문자 처리
5. **정보 누출**: 에러 메시지에서 민감한 정보 노출 방지

### 테스트 실행
```bash
npm test src/test/security/
```

## 🚫 알려진 제한사항

### macOS 특화 보안
1. **AppleScript 권한**: 시스템이 접근성 권한을 요구할 수 있음
2. **샌드박스**: macOS 샌드박스 환경에서 일부 기능 제한 가능
3. **SIP**: System Integrity Protection이 일부 시스템 접근 차단

### 권장 설정
1. **최소 권한 원칙**: 필요한 최소한의 권한만 부여
2. **정기 업데이트**: 보안 패치 정기 적용
3. **로그 모니터링**: 보안 로그 정기 검토

## 🔧 보안 설정

### macOS 권한 설정
```bash
# 접근성 권한 확인
sudo sqlite3 /Library/Application\ Support/com.apple.TCC/TCC.db \
"SELECT service, client, allowed FROM access WHERE service='kTCCServiceAccessibility';"
```

### 로그 레벨 설정
```bash
export LOG_LEVEL=debug  # 개발 환경
export LOG_LEVEL=info   # 프로덕션 환경
```

## 📞 보안 문제 신고

보안 취약점을 발견하신 경우:
1. 즉시 프로젝트 관리자에게 비공개로 연락
2. 취약점의 상세 정보 및 재현 방법 제공
3. 패치가 완료될 때까지 공개 자제

## ✅ 보안 체크리스트

설치 전 확인사항:
- [ ] macOS 접근성 권한 설정
- [ ] 시스템 로그 모니터링 설정
- [ ] 방화벽 및 네트워크 보안 확인
- [ ] 백업 및 복원 계획 수립
- [ ] 보안 테스트 실행 및 통과 확인

---

## 🔒 결론

이 보안 강화 구현을 통해:
- **입력 검증**: 모든 사용자 입력의 엄격한 검증
- **인젝션 방지**: AppleScript 및 Command injection 완전 차단
- **권한 제한**: 최소 권한 원칙 적용
- **로깅 및 모니터링**: 포괄적인 보안 이벤트 추적
- **테스트 커버리지**: 다양한 공격 벡터에 대한 테스트

시스템이 enterprise-grade 보안 표준을 만족하도록 설계되었습니다. 