Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
shell.CurrentDirectory = scriptDir

' 포트 8900이 이미 사용 중인지 확인
Set checkExec = shell.Exec("cmd /c netstat -an | find "":8900 "" | find ""LISTENING""")
portInUse = Trim(checkExec.StdOut.ReadAll())

If portInUse = "" Then
    ' 서버 시작 (완전히 숨김, 콘솔창 안 뜸)
    shell.Run "cmd /c cd /d """ & scriptDir & """ && python _checker_server.py", 0, False
    WScript.Sleep 1500
End If

' ---------------------------------------------------------------
' 열 버전 자동 탐색 [2026-08-17 변경]
'
' 문제: 예전에는 열 파일명이 v6로 하드코딩돼 있었다. 그래서 v7을 새로 만들고도
'       이 줄을 같이 안 고치면 계속 예전 버전이 열린다(실제로 그랬다).
'       버전 올릴 때마다 사람이 기억해서 고쳐야 하는 구조 자체가 원인이다.
' 해결: 폴더에서 "MEE_..._v<숫자>.html" 중 숫자가 가장 큰 것을 자동 선택.
'       앞으로 v8, v9를 만들어도 이 파일은 손댈 필요 없다.
'
' 주의: 파일명 비교에 한글을 쓰지 않는다. 이 .vbs가 어떤 인코딩으로 저장되느냐에
'       따라 한글 문자열 리터럴이 깨져서 매칭이 통째로 실패할 수 있기 때문이다
'       (원본 파일도 같은 이유로 URL을 퍼센트 인코딩으로만 적어뒀던 것으로 보인다).
'       ASCII 부분("MEE_" 시작 + "_v숫자.html" 끝)만으로 충분히 특정된다.
' ---------------------------------------------------------------
bestNum = -1

For Each f In fso.GetFolder(scriptDir).Files
    fname = f.Name
    If Left(fname, 4) = "MEE_" And LCase(Right(fname, 5)) = ".html" Then
        p = InStrRev(fname, "_v")
        If p > 0 Then
            numPart = Mid(fname, p + 2, Len(fname) - (p + 1) - 5)
            If Len(numPart) > 0 And IsNumeric(numPart) Then
                If CLng(numPart) > bestNum Then bestNum = CLng(numPart)
            End If
        End If
    End If
Next

If bestNum < 0 Then
    MsgBox "Checker HTML not found." & vbCrLf & _
           "(expected: MEE_..._v<number>.html)" & vbCrLf & vbCrLf & _
           scriptDir, 48, "MEE Checker"
    WScript.Quit
End If

' 한글 파일명은 URL에서 퍼센트 인코딩이 필요하다. "정직성체커" 부분은 고정이라
' 인코딩된 문자열을 그대로 쓰고, 버전 숫자만 위에서 찾은 값으로 붙인다.
encodedName = "MEE_%EC%A0%95%EC%A7%81%EC%84%B1%EC%B2%B4%EC%BB%A4_v" & bestNum & ".html"
url = "http://localhost:8900/" & encodedName

' 브라우저로 앱 열기 (기본 브라우저로 열림)
shell.Run url, 1, False
