from fastapi import Depends, HTTPException, status
from .db import get_session as get_db
from .auth import get_current_user
from .models import User
import json

def require_permission(permission: str):
    def permission_checker(current_user: User = Depends(get_current_user)):
        if not current_user.is_active:
            raise HTTPException(status_code=400, detail="Inactive user")
        
        if not current_user.role:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, 
                detail="User has no role assigned"
            )
        
        try:
            user_permissions = json.loads(current_user.role.permissions)
        except:
            user_permissions = []
            
        if "*" in user_permissions or permission in user_permissions:
            return current_user
        
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Operation not permitted. Requires '{permission}'"
        )
    return permission_checker